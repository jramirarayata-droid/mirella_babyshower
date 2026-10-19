-- =============================================================================
--  MIR & ELLA WEDDING — SUPABASE SCHEMA
--  Run this whole file once in: Supabase Dashboard → SQL Editor → New query.
--  It is idempotent where practical (safe to re-run on an empty project).
--
--  THEN ALSO RUN every file in supabase/migrations/ in order
--  (002_outfits_messages_included_guests.sql adds the outfit gallery, the
--  message to the couple and admin-included guests).
--
--  Contents
--    1. Extensions
--    2. Helper functions (name normalisation, updated_at)
--    3. Tables, constraints, indexes, foreign keys
--    4. Admin authorisation (admin_users + is_admin())
--    5. Row Level Security + policies
--    6. Public RPC functions (find_invitation, find_invitation_by_code, submit_rsvp)
--    7. Activity-log triggers
--    8. Storage bucket (wedding-assets) + policies
--    9. Grants
--   10. Default wedding_settings record
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- -----------------------------------------------------------------------------
-- gen_random_uuid() is built into PostgreSQL 13+, pgcrypto kept for completeness.
create extension if not exists pgcrypto with schema extensions;


-- -----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Normalises a person's name for matching:
--   trim leading/trailing whitespace, collapse internal whitespace, lowercase.
create or replace function public.normalize_name(p_name text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

-- Keeps updated_at current on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 3. TABLES
-- -----------------------------------------------------------------------------

-- TABLE 1 — wedding_settings (single row that drives the public website)
create table if not exists public.wedding_settings (
  id                 uuid primary key default gen_random_uuid(),
  singleton          boolean not null default true unique check (singleton),
  couple_names       text not null default 'Mir & Ella',
  wedding_date       date not null default '2026-12-19',
  hero_title         text,
  hero_subtitle      text,
  hero_image_url     text,
  church_name        text,
  church_map_url     text,
  reception_name     text,
  reception_map_url  text,
  story_text         text,          -- the introduction text shown under the hero
  closing_message    text,          -- the subtle footer message
  additional_info    jsonb not null default '[]'::jsonb,  -- information sections
  updated_at         timestamptz not null default now(),
  constraint wedding_settings_additional_info_is_array
    check (jsonb_typeof(additional_info) = 'array')
);

-- TABLE 2 — invitations
create table if not exists public.invitations (
  id                     uuid primary key default gen_random_uuid(),
  invitee_name           text not null,
  search_name            text generated always as (public.normalize_name(invitee_name)) stored,
  invitation_code        text not null unique
                         default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  table_number           text,
  max_additional_guests  integer not null default 0,
  is_active              boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint invitations_invitee_name_required
    check (char_length(btrim(invitee_name)) between 1 and 150),
  constraint invitations_table_number_length
    check (table_number is null or char_length(table_number) <= 50),
  constraint invitations_max_additional_guests_range
    check (max_additional_guests between 0 and 10)
);

create index if not exists invitations_search_name_idx on public.invitations (search_name);

-- Two ACTIVE invitations must not share the same normalised name, otherwise
-- the public name search would be ambiguous.
create unique index if not exists invitations_active_search_name_uniq
  on public.invitations (search_name) where is_active;

-- TABLE 3 — rsvp_responses (one current response per invitation)
create table if not exists public.rsvp_responses (
  id                         uuid primary key default gen_random_uuid(),
  invitation_id              uuid not null references public.invitations (id) on delete cascade,
  attendance_status          text not null,
  has_transportation         boolean,
  needs_transportation       text,
  vehicle_type               text,
  coming_from                varchar(120),
  food_preferences           text[] not null default '{}',
  has_food_restrictions      boolean,
  food_restrictions          varchar(120),
  accessibility_needs        varchar(255),
  bringing_additional_guest  boolean not null default false,
  submitted_at               timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint rsvp_responses_invitation_unique unique (invitation_id),
  constraint rsvp_attendance_status_valid
    check (attendance_status in ('attending', 'declining')),
  constraint rsvp_needs_transportation_valid
    check (needs_transportation is null or needs_transportation in ('yes', 'no', 'not_sure')),
  constraint rsvp_vehicle_type_valid
    check (vehicle_type is null or vehicle_type in ('sedan', 'suv', 'van', 'motorcycle', 'other')),
  constraint rsvp_food_preferences_valid
    check (
      cardinality(food_preferences) <= 4
      and food_preferences <@ array['vegetable', 'pasta', 'fish', 'pork', 'beef', 'chicken']::text[]
    ),
  constraint rsvp_food_restrictions_consistent
    check (has_food_restrictions is true or food_restrictions is null),
  constraint rsvp_declining_has_no_details
    check (
      attendance_status = 'attending'
      or (
        has_transportation is null and needs_transportation is null and vehicle_type is null
        and coming_from is null and cardinality(food_preferences) = 0
        and has_food_restrictions is null and food_restrictions is null
        and accessibility_needs is null and bringing_additional_guest = false
      )
    )
);

create index if not exists rsvp_responses_status_idx on public.rsvp_responses (attendance_status);

-- TABLE 4 — additional_guests (one row per requested guest)
create table if not exists public.additional_guests (
  id                uuid primary key default gen_random_uuid(),
  invitation_id     uuid not null references public.invitations (id) on delete cascade,
  rsvp_response_id  uuid not null references public.rsvp_responses (id) on delete cascade,
  guest_name        varchar(150) not null,
  status            text not null default 'pending',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint additional_guests_name_required check (char_length(btrim(guest_name)) >= 1),
  constraint additional_guests_status_valid check (status in ('pending', 'approved', 'declined'))
);

create index if not exists additional_guests_invitation_idx on public.additional_guests (invitation_id);
create index if not exists additional_guests_rsvp_idx on public.additional_guests (rsvp_response_id);
create index if not exists additional_guests_status_idx on public.additional_guests (status);

-- TABLE 5 — admin_activity_logs
create table if not exists public.admin_activity_logs (
  id             uuid primary key default gen_random_uuid(),
  admin_user_id  uuid default auth.uid(),
  action         text not null,
  target_table   text,
  target_id      uuid,
  details        jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists admin_activity_logs_created_idx on public.admin_activity_logs (created_at desc);

-- updated_at triggers
drop trigger if exists wedding_settings_updated_at on public.wedding_settings;
create trigger wedding_settings_updated_at before update on public.wedding_settings
  for each row execute function public.set_updated_at();

drop trigger if exists invitations_updated_at on public.invitations;
create trigger invitations_updated_at before update on public.invitations
  for each row execute function public.set_updated_at();

drop trigger if exists rsvp_responses_updated_at on public.rsvp_responses;
create trigger rsvp_responses_updated_at before update on public.rsvp_responses
  for each row execute function public.set_updated_at();

drop trigger if exists additional_guests_updated_at on public.additional_guests;
create trigger additional_guests_updated_at before update on public.additional_guests
  for each row execute function public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. ADMIN AUTHORISATION
-- -----------------------------------------------------------------------------
-- Being "logged in" is NOT enough to be an admin. Only Supabase Auth users that
-- are listed in admin_users get administrative access. This protects the data
-- even if public sign-ups are accidentally left enabled on the project.

create table if not exists public.admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  email       text,
  created_at  timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  );
$$;


-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.wedding_settings     enable row level security;
alter table public.invitations          enable row level security;
alter table public.rsvp_responses       enable row level security;
alter table public.additional_guests    enable row level security;
alter table public.admin_activity_logs  enable row level security;
alter table public.admin_users          enable row level security;

-- wedding_settings: public website content is readable by everyone,
-- only admins may change it.
drop policy if exists "Public can read wedding settings" on public.wedding_settings;
create policy "Public can read wedding settings"
  on public.wedding_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can update wedding settings" on public.wedding_settings;
create policy "Admins can update wedding settings"
  on public.wedding_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can insert wedding settings" on public.wedding_settings;
create policy "Admins can insert wedding settings"
  on public.wedding_settings for insert
  to authenticated
  with check (public.is_admin());

-- invitations: admins only. The public NEVER reads this table directly;
-- they use the find_invitation() RPC.
drop policy if exists "Admins can read invitations" on public.invitations;
create policy "Admins can read invitations"
  on public.invitations for select to authenticated using (public.is_admin());

drop policy if exists "Admins can insert invitations" on public.invitations;
create policy "Admins can insert invitations"
  on public.invitations for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update invitations" on public.invitations;
create policy "Admins can update invitations"
  on public.invitations for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete invitations" on public.invitations;
create policy "Admins can delete invitations"
  on public.invitations for delete to authenticated using (public.is_admin());

-- rsvp_responses: admins read/delete. Guests write only via submit_rsvp().
drop policy if exists "Admins can read responses" on public.rsvp_responses;
create policy "Admins can read responses"
  on public.rsvp_responses for select to authenticated using (public.is_admin());

drop policy if exists "Admins can delete responses" on public.rsvp_responses;
create policy "Admins can delete responses"
  on public.rsvp_responses for delete to authenticated using (public.is_admin());

-- additional_guests: admins read / update status / delete.
drop policy if exists "Admins can read additional guests" on public.additional_guests;
create policy "Admins can read additional guests"
  on public.additional_guests for select to authenticated using (public.is_admin());

drop policy if exists "Admins can update additional guests" on public.additional_guests;
create policy "Admins can update additional guests"
  on public.additional_guests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete additional guests" on public.additional_guests;
create policy "Admins can delete additional guests"
  on public.additional_guests for delete to authenticated using (public.is_admin());

-- admin_activity_logs: admins read and insert (their own id only).
drop policy if exists "Admins can read activity logs" on public.admin_activity_logs;
create policy "Admins can read activity logs"
  on public.admin_activity_logs for select to authenticated using (public.is_admin());

drop policy if exists "Admins can insert activity logs" on public.admin_activity_logs;
create policy "Admins can insert activity logs"
  on public.admin_activity_logs for insert to authenticated
  with check (public.is_admin() and admin_user_id = auth.uid());

-- admin_users: a signed-in user may only see their own admin row
-- (used by the frontend to confirm admin status).
drop policy if exists "Users can read their own admin row" on public.admin_users;
create policy "Users can read their own admin row"
  on public.admin_users for select to authenticated using (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 6. PUBLIC RPC FUNCTIONS
-- -----------------------------------------------------------------------------

-- 6a. find_invitation — secure name search.
--     Returns at most ONE active invitation that exactly matches the normalised
--     name, and only the minimum fields the RSVP page needs.
drop function if exists public.find_invitation(text);
create or replace function public.find_invitation(search_name text)
returns table (
  invitation_id          uuid,
  invitee_name           text,
  table_number           text,
  max_additional_guests  integer,
  has_existing_response  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.invitee_name,
    i.table_number,
    i.max_additional_guests,
    exists (select 1 from public.rsvp_responses r where r.invitation_id = i.id)
  from public.invitations i
  where i.is_active
    and char_length(public.normalize_name(find_invitation.search_name)) > 0
    and i.search_name = public.normalize_name(find_invitation.search_name)
  limit 1;
$$;

-- 6b. find_invitation_by_code — future-ready support for /rsvp?invite=CODE links.
--     Same minimal output as find_invitation.
drop function if exists public.find_invitation_by_code(text);
create or replace function public.find_invitation_by_code(invite_code text)
returns table (
  invitation_id          uuid,
  invitee_name           text,
  table_number           text,
  max_additional_guests  integer,
  has_existing_response  boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.invitee_name,
    i.table_number,
    i.max_additional_guests,
    exists (select 1 from public.rsvp_responses r where r.invitation_id = i.id)
  from public.invitations i
  where i.is_active
    and i.invitation_code = btrim(coalesce(find_invitation_by_code.invite_code, ''))
  limit 1;
$$;

-- 6c. submit_rsvp — the ONLY way a guest can write data.
--     * validates everything server-side (mirrors the client validation)
--     * upserts the single rsvp_responses row for the invitation
--     * reconciles additional_guests: keeps existing rows whose names are still
--       listed (so an already-approved guest stays approved), deletes removed
--       names, inserts new names as 'pending'.
--     Errors are raised with short codes (e.g. RSVP_INVALID) that the frontend
--     maps to friendly messages.
drop function if exists public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[]);
create or replace function public.submit_rsvp(
  p_invitation_id          uuid,
  p_attendance_status      text,
  p_has_transportation     boolean default null,
  p_needs_transportation   text    default null,
  p_vehicle_type           text    default null,
  p_coming_from            text    default null,
  p_food_preferences       text[]  default '{}',
  p_has_food_restrictions  boolean default null,
  p_food_restrictions      text    default null,
  p_accessibility_needs    text    default null,
  p_additional_guests      text[]  default '{}'
)
returns table (rsvp_id uuid, attendance_status text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_invitation   public.invitations%rowtype;
  v_rsvp_id      uuid;
  v_guests       text[] := '{}';
  v_food         text[] := '{}';
  v_name         text;
  v_coming_from  text;
  v_restrictions text;
  v_access       text;
begin
  -- Invitation must exist and be active. Lock it to serialise concurrent submits.
  select * into v_invitation
  from public.invitations
  where id = p_invitation_id and is_active
  for update;

  if not found then
    raise exception 'RSVP_INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_attendance_status is null or p_attendance_status not in ('attending', 'declining') then
    raise exception 'RSVP_INVALID: attendance' using errcode = '22023';
  end if;

  if p_attendance_status = 'attending' then
    -- Transportation
    if p_has_transportation is null then
      raise exception 'RSVP_INVALID: transportation' using errcode = '22023';
    end if;
    if p_has_transportation then
      if p_vehicle_type is null or p_vehicle_type not in ('sedan', 'suv', 'van', 'motorcycle', 'other') then
        raise exception 'RSVP_INVALID: vehicle_type' using errcode = '22023';
      end if;
    else
      if p_needs_transportation is null or p_needs_transportation not in ('yes', 'no', 'not_sure') then
        raise exception 'RSVP_INVALID: needs_transportation' using errcode = '22023';
      end if;
    end if;

    -- Coming from (required, max 120)
    v_coming_from := nullif(regexp_replace(btrim(coalesce(p_coming_from, '')), '\s+', ' ', 'g'), '');
    if v_coming_from is null or char_length(v_coming_from) > 120 then
      raise exception 'RSVP_INVALID: coming_from' using errcode = '22023';
    end if;

    -- Food preferences (0–4 distinct allowed values)
    select coalesce(array_agg(distinct f order by f), '{}')
      into v_food
      from unnest(coalesce(p_food_preferences, '{}')) as f;
    if cardinality(v_food) > 4
       or not (v_food <@ array['vegetable', 'pasta', 'fish', 'pork', 'beef', 'chicken']::text[]) then
      raise exception 'RSVP_INVALID: food_preferences' using errcode = '22023';
    end if;

    -- Food restrictions
    if p_has_food_restrictions is null then
      raise exception 'RSVP_INVALID: has_food_restrictions' using errcode = '22023';
    end if;
    if p_has_food_restrictions then
      v_restrictions := nullif(btrim(coalesce(p_food_restrictions, '')), '');
      if v_restrictions is null or char_length(v_restrictions) > 120 then
        raise exception 'RSVP_INVALID: food_restrictions' using errcode = '22023';
      end if;
    end if;

    -- Accessibility (optional, max 255)
    v_access := nullif(btrim(coalesce(p_accessibility_needs, '')), '');
    if v_access is not null and char_length(v_access) > 255 then
      raise exception 'RSVP_INVALID: accessibility_needs' using errcode = '22023';
    end if;

    -- Additional guests: trimmed, non-empty, <=150 chars, no duplicates,
    -- never more than the invitation allows.
    foreach v_name in array coalesce(p_additional_guests, '{}') loop
      v_name := regexp_replace(btrim(coalesce(v_name, '')), '\s+', ' ', 'g');
      if v_name = '' then
        raise exception 'RSVP_INVALID: guest_name_empty' using errcode = '22023';
      end if;
      if char_length(v_name) > 150 then
        raise exception 'RSVP_INVALID: guest_name_length' using errcode = '22023';
      end if;
      if exists (select 1 from unnest(v_guests) g where public.normalize_name(g) = public.normalize_name(v_name)) then
        raise exception 'RSVP_INVALID: guest_name_duplicate' using errcode = '22023';
      end if;
      v_guests := array_append(v_guests, v_name);
    end loop;

    if cardinality(v_guests) > v_invitation.max_additional_guests then
      raise exception 'RSVP_INVALID: too_many_guests' using errcode = '22023';
    end if;
  end if;

  -- Upsert the single current response for this invitation.
  insert into public.rsvp_responses as r (
    invitation_id, attendance_status, has_transportation, needs_transportation,
    vehicle_type, coming_from, food_preferences, has_food_restrictions,
    food_restrictions, accessibility_needs, bringing_additional_guest,
    submitted_at, updated_at
  ) values (
    v_invitation.id,
    p_attendance_status,
    case when p_attendance_status = 'attending' then p_has_transportation end,
    case when p_attendance_status = 'attending' and not p_has_transportation then p_needs_transportation end,
    case when p_attendance_status = 'attending' and p_has_transportation then p_vehicle_type end,
    case when p_attendance_status = 'attending' then v_coming_from end,
    case when p_attendance_status = 'attending' then v_food else '{}'::text[] end,
    case when p_attendance_status = 'attending' then p_has_food_restrictions end,
    case when p_attendance_status = 'attending' and p_has_food_restrictions then v_restrictions end,
    case when p_attendance_status = 'attending' then v_access end,
    p_attendance_status = 'attending' and cardinality(v_guests) > 0,
    now(), now()
  )
  on conflict (invitation_id) do update set
    attendance_status         = excluded.attendance_status,
    has_transportation        = excluded.has_transportation,
    needs_transportation      = excluded.needs_transportation,
    vehicle_type              = excluded.vehicle_type,
    coming_from               = excluded.coming_from,
    food_preferences          = excluded.food_preferences,
    has_food_restrictions     = excluded.has_food_restrictions,
    food_restrictions         = excluded.food_restrictions,
    accessibility_needs       = excluded.accessibility_needs,
    bringing_additional_guest = excluded.bringing_additional_guest
  returning r.id into v_rsvp_id;

  -- Reconcile additional guests.
  delete from public.additional_guests ag
  where ag.invitation_id = v_invitation.id
    and (
      ag.rsvp_response_id <> v_rsvp_id
      or not exists (
        select 1 from unnest(v_guests) g
        where public.normalize_name(g) = public.normalize_name(ag.guest_name)
      )
    );

  insert into public.additional_guests (invitation_id, rsvp_response_id, guest_name, status)
  select v_invitation.id, v_rsvp_id, g, 'pending'
  from unnest(v_guests) g
  where not exists (
    select 1 from public.additional_guests ag
    where ag.invitation_id = v_invitation.id
      and public.normalize_name(ag.guest_name) = public.normalize_name(g)
  );

  return query select v_rsvp_id, p_attendance_status;
end;
$$;


-- -----------------------------------------------------------------------------
-- 7. ACTIVITY-LOG TRIGGERS
-- -----------------------------------------------------------------------------
-- Admin actions are logged by the database itself, so logging cannot be
-- skipped by a buggy or modified client. Changes made by guests through
-- submit_rsvp() are not logged (auth.uid() is not an admin).
-- RSVP rows removed by ON DELETE CASCADE (because their invitation was deleted)
-- are not logged separately; the invitation delete is logged instead.

create or replace function public.log_admin_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action  text;
  v_target  uuid;
  v_details jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'invitations' then
    v_target := coalesce(new.id, old.id);
    if tg_op = 'INSERT' then
      v_action := 'invitation_created';
      v_details := jsonb_build_object('invitee_name', new.invitee_name, 'table_number', new.table_number,
                                      'max_additional_guests', new.max_additional_guests, 'is_active', new.is_active);
    elsif tg_op = 'UPDATE' then
      v_action := 'invitation_updated';
      v_details := jsonb_build_object(
        'before', jsonb_build_object('invitee_name', old.invitee_name, 'table_number', old.table_number,
                                     'max_additional_guests', old.max_additional_guests, 'is_active', old.is_active),
        'after',  jsonb_build_object('invitee_name', new.invitee_name, 'table_number', new.table_number,
                                     'max_additional_guests', new.max_additional_guests, 'is_active', new.is_active));
    else
      v_action := 'invitation_deleted';
      v_details := jsonb_build_object('invitee_name', old.invitee_name, 'table_number', old.table_number);
    end if;

  elsif tg_table_name = 'rsvp_responses' and tg_op = 'DELETE' then
    if not exists (select 1 from public.invitations i where i.id = old.invitation_id) then
      return old;  -- cascaded from an invitation delete
    end if;
    v_action := 'rsvp_deleted';
    v_target := old.id;
    v_details := jsonb_build_object('invitation_id', old.invitation_id, 'attendance_status', old.attendance_status);

  elsif tg_table_name = 'additional_guests' and tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return new;
    end if;
    v_action := 'guest_status_changed';
    v_target := new.id;
    v_details := jsonb_build_object('guest_name', new.guest_name, 'from', old.status, 'to', new.status,
                                    'invitation_id', new.invitation_id);

  elsif tg_table_name = 'wedding_settings' and tg_op = 'UPDATE' then
    v_action := 'settings_updated';
    v_target := new.id;
    select coalesce(jsonb_agg(n.key), '[]'::jsonb) into v_details
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key <> 'updated_at';
    v_details := jsonb_build_object('changed_fields', v_details);
  else
    return coalesce(new, old);
  end if;

  insert into public.admin_activity_logs (admin_user_id, action, target_table, target_id, details)
  values (auth.uid(), v_action, tg_table_name, v_target, v_details);

  return coalesce(new, old);
end;
$$;

drop trigger if exists invitations_activity_log on public.invitations;
create trigger invitations_activity_log
  after insert or update or delete on public.invitations
  for each row execute function public.log_admin_activity();

drop trigger if exists rsvp_responses_activity_log on public.rsvp_responses;
create trigger rsvp_responses_activity_log
  after delete on public.rsvp_responses
  for each row execute function public.log_admin_activity();

drop trigger if exists additional_guests_activity_log on public.additional_guests;
create trigger additional_guests_activity_log
  after update on public.additional_guests
  for each row execute function public.log_admin_activity();

drop trigger if exists wedding_settings_activity_log on public.wedding_settings;
create trigger wedding_settings_activity_log
  after update on public.wedding_settings
  for each row execute function public.log_admin_activity();


-- -----------------------------------------------------------------------------
-- 8. STORAGE — wedding-assets bucket (hero image, logo, backgrounds)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wedding-assets', 'wedding-assets', true, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view wedding assets" on storage.objects;
create policy "Public can view wedding assets"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'wedding-assets');

drop policy if exists "Admins can upload wedding assets" on storage.objects;
create policy "Admins can upload wedding assets"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'wedding-assets' and public.is_admin());

drop policy if exists "Admins can update wedding assets" on storage.objects;
create policy "Admins can update wedding assets"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'wedding-assets' and public.is_admin())
  with check (bucket_id = 'wedding-assets' and public.is_admin());

drop policy if exists "Admins can delete wedding assets" on storage.objects;
create policy "Admins can delete wedding assets"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'wedding-assets' and public.is_admin());


-- -----------------------------------------------------------------------------
-- 9. GRANTS (defence in depth on top of RLS)
-- -----------------------------------------------------------------------------
-- anon (public visitors) may only read wedding_settings and call the two RPCs.
revoke all on public.invitations, public.rsvp_responses, public.additional_guests,
              public.admin_activity_logs, public.admin_users from anon;
revoke all on public.wedding_settings from anon;
grant select on public.wedding_settings to anon;

grant select, insert, update, delete on
  public.wedding_settings, public.invitations, public.rsvp_responses,
  public.additional_guests, public.admin_activity_logs
  to authenticated;               -- still restricted to admins by RLS
grant select on public.admin_users to authenticated;

revoke execute on function public.find_invitation(text) from public;
revoke execute on function public.find_invitation_by_code(text) from public;
revoke execute on function public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[]) from public;
revoke execute on function public.log_admin_activity() from public;
revoke execute on function public.is_admin() from public;

grant execute on function public.find_invitation(text) to anon, authenticated;
grant execute on function public.find_invitation_by_code(text) to anon, authenticated;
grant execute on function public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[]) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.normalize_name(text) to anon, authenticated;

-- Supabase also grants EXECUTE to anon/authenticated by default, so revoke
-- explicitly on functions that must not be callable through the API.
revoke execute on function public.is_admin() from anon;
revoke execute on function public.log_admin_activity() from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 10. DEFAULT WEDDING SETTINGS
-- -----------------------------------------------------------------------------
insert into public.wedding_settings (
  couple_names, wedding_date, hero_title, hero_subtitle, hero_image_url,
  church_name, church_map_url, reception_name, reception_map_url,
  story_text, closing_message, additional_info
)
values (
  'Mir & Ella',
  '2026-12-19',
  'Mir & Ella',
  'are getting married',
  'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=2400&q=80',
  'San Francisco De Malabon Parish Church',
  'https://maps.app.goo.gl/MhadGRaZYu4L28jc9',
  'Lawiswis Kawayan By Japong''s Sizzling Hub',
  'https://maps.app.goo.gl/bafw5qXFsG3142iM8',
  'With joyful hearts, we invite you to celebrate this special day with us.',
  'Thank you for being part of our story. We can''t wait to celebrate with you.',
  '[
    {"id": "dress-code", "title": "Dress Code", "icon": "shirt", "visible": true,
     "body": "Formal attire. We would love to see you in soft, timeless tones — champagne, ivory, taupe and sage.\nKindly reserve white for the bride."},
    {"id": "ceremony", "title": "Ceremony", "icon": "church", "visible": true,
     "body": "Our Holy Mass will be celebrated at San Francisco De Malabon Parish Church.\nPlease arrive at least 30 minutes early so you can be seated before the processional begins."},
    {"id": "reception", "title": "Reception", "icon": "wine", "visible": true,
     "body": "Dinner, toasts and dancing follow at Lawiswis Kawayan By Japong''s Sizzling Hub.\nYour table number will be shown on your invitation when you RSVP."},
    {"id": "unplugged", "title": "Unplugged Ceremony", "icon": "camera-off", "visible": true,
     "body": "We invite you to be fully present with us. Kindly keep phones and cameras away during the ceremony — our photographers will capture every moment, and we will happily share them with you."},
    {"id": "gifts", "title": "Gifts", "icon": "gift", "visible": true,
     "body": "Your presence is the greatest gift of all.\nShould you wish to honour us further, a monetary gift toward our new life together would be warmly appreciated."}
  ]'::jsonb
)
on conflict (singleton) do nothing;

-- =============================================================================
--  AFTER RUNNING THIS FILE: make yourself an admin (see README, "Admin account")
--
--    insert into public.admin_users (user_id, email)
--    select id, email from auth.users where email = 'you@example.com';
-- =============================================================================
