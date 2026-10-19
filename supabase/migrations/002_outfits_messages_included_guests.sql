-- =============================================================================
--  MIGRATION 002 — outfit gallery, message to the couple, admin-included guests
--  Run AFTER schema.sql on an existing project (SQL Editor → New query → Run).
--  Safe to re-run. (Already applied to the live project on 2026-09-30.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Outfit inspiration section (title/subtitle/visibility live in settings)
-- -----------------------------------------------------------------------------
alter table public.wedding_settings
  add column if not exists outfit_title text default 'Attire Inspiration',
  add column if not exists outfit_subtitle text default 'A few ideas to help you plan your look for the day.',
  add column if not exists outfit_section_visible boolean not null default true;

create table if not exists public.outfit_images (
  id          uuid primary key default gen_random_uuid(),
  gender      text not null,
  image_url   text not null,
  caption     varchar(120),
  sort_order  integer not null default 0,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint outfit_images_gender_valid check (gender in ('male', 'female')),
  constraint outfit_images_url_valid check (
    char_length(image_url) between 1 and 1000
    and (image_url ~* '^https?://' or image_url ~ '^samples/')
  )
);

create index if not exists outfit_images_gender_order_idx on public.outfit_images (gender, sort_order);

drop trigger if exists outfit_images_updated_at on public.outfit_images;
create trigger outfit_images_updated_at before update on public.outfit_images
  for each row execute function public.set_updated_at();

alter table public.outfit_images enable row level security;

drop policy if exists "Public can view visible outfit images" on public.outfit_images;
create policy "Public can view visible outfit images"
  on public.outfit_images for select to anon, authenticated using (is_visible);

drop policy if exists "Admins can read outfit images" on public.outfit_images;
create policy "Admins can read outfit images"
  on public.outfit_images for select to authenticated using (public.is_admin());

drop policy if exists "Admins can insert outfit images" on public.outfit_images;
create policy "Admins can insert outfit images"
  on public.outfit_images for insert to authenticated with check (public.is_admin());

drop policy if exists "Admins can update outfit images" on public.outfit_images;
create policy "Admins can update outfit images"
  on public.outfit_images for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete outfit images" on public.outfit_images;
create policy "Admins can delete outfit images"
  on public.outfit_images for delete to authenticated using (public.is_admin());

revoke all on public.outfit_images from anon;
grant select on public.outfit_images to anon;
grant select, insert, update, delete on public.outfit_images to authenticated;

-- Temporary sample illustrations (files live in the site's public/samples/ folder).
insert into public.outfit_images (gender, image_url, caption, sort_order)
select * from (values
  ('male',   'samples/outfits/male-classic-suit.svg', 'Classic dark suit & tie', 1),
  ('male',   'samples/outfits/male-barong.svg',       'Barong Tagalog',          2),
  ('male',   'samples/outfits/male-light-suit.svg',   'Light neutral suit',      3),
  ('female', 'samples/outfits/female-gown.svg',       'Champagne evening gown',  1),
  ('female', 'samples/outfits/female-filipiniana.svg','Modern Filipiniana',      2),
  ('female', 'samples/outfits/female-cocktail.svg',   'Dusty rose midi dress',   3)
) as v(gender, image_url, caption, sort_order)
where not exists (select 1 from public.outfit_images);

-- -----------------------------------------------------------------------------
-- 2. Message to the couple (last RSVP question, attending guests only)
-- -----------------------------------------------------------------------------
alter table public.rsvp_responses
  add column if not exists message_to_couple varchar(500);

alter table public.rsvp_responses drop constraint if exists rsvp_declining_has_no_details;
alter table public.rsvp_responses add constraint rsvp_declining_has_no_details check (
  attendance_status = 'attending'
  or (
    has_transportation is null and needs_transportation is null and vehicle_type is null
    and coming_from is null and cardinality(food_preferences) = 0
    and has_food_restrictions is null and food_restrictions is null
    and accessibility_needs is null and bringing_additional_guest = false
    and message_to_couple is null
  )
);

-- -----------------------------------------------------------------------------
-- 3. Additional guests: who added them (admin = included in the invitation,
--    invitee = requested on the RSVP form and needs approval)
-- -----------------------------------------------------------------------------
alter table public.additional_guests
  add column if not exists added_by text not null default 'invitee';

alter table public.additional_guests drop constraint if exists additional_guests_added_by_valid;
alter table public.additional_guests add constraint additional_guests_added_by_valid
  check (added_by in ('admin', 'invitee'));

-- Admin-included guests exist before (and independently of) any RSVP.
alter table public.additional_guests alter column rsvp_response_id drop not null;

alter table public.additional_guests drop constraint if exists additional_guests_invitee_needs_rsvp;
alter table public.additional_guests add constraint additional_guests_invitee_needs_rsvp
  check (added_by = 'admin' or rsvp_response_id is not null);

-- The same person can't be listed twice on one invitation.
create unique index if not exists additional_guests_unique_name_per_invitation
  on public.additional_guests (invitation_id, public.normalize_name(guest_name));

drop policy if exists "Admins can insert additional guests" on public.additional_guests;
create policy "Admins can insert additional guests"
  on public.additional_guests for insert to authenticated with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. Public lookup RPCs now also return the admin-included guest names
-- -----------------------------------------------------------------------------
drop function if exists public.find_invitation(text);
create function public.find_invitation(search_name text)
returns table (
  invitation_id          uuid,
  invitee_name           text,
  table_number           text,
  max_additional_guests  integer,
  has_existing_response  boolean,
  included_guests        text[]
)
language sql stable security definer set search_path = ''
as $$
  select
    i.id, i.invitee_name, i.table_number, i.max_additional_guests,
    exists (select 1 from public.rsvp_responses r where r.invitation_id = i.id),
    coalesce((select array_agg(g.guest_name::text order by g.created_at, g.guest_name)
              from public.additional_guests g
              where g.invitation_id = i.id and g.added_by = 'admin'), '{}')
  from public.invitations i
  where i.is_active
    and char_length(public.normalize_name(find_invitation.search_name)) > 0
    and i.search_name = public.normalize_name(find_invitation.search_name)
  limit 1;
$$;

drop function if exists public.find_invitation_by_code(text);
create function public.find_invitation_by_code(invite_code text)
returns table (
  invitation_id          uuid,
  invitee_name           text,
  table_number           text,
  max_additional_guests  integer,
  has_existing_response  boolean,
  included_guests        text[]
)
language sql stable security definer set search_path = ''
as $$
  select
    i.id, i.invitee_name, i.table_number, i.max_additional_guests,
    exists (select 1 from public.rsvp_responses r where r.invitation_id = i.id),
    coalesce((select array_agg(g.guest_name::text order by g.created_at, g.guest_name)
              from public.additional_guests g
              where g.invitation_id = i.id and g.added_by = 'admin'), '{}')
  from public.invitations i
  where i.is_active
    and i.invitation_code = btrim(coalesce(find_invitation_by_code.invite_code, ''))
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 5. submit_rsvp — adds the message, never touches admin-included guests
-- -----------------------------------------------------------------------------
drop function if exists public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[]);
drop function if exists public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text);
create function public.submit_rsvp(
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
  p_additional_guests      text[]  default '{}',
  p_message_to_couple      text    default null
)
returns table (rsvp_id uuid, attendance_status text)
language plpgsql volatile security definer set search_path = ''
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
  v_message      text;
begin
  select * into v_invitation from public.invitations where id = p_invitation_id and is_active for update;
  if not found then
    raise exception 'RSVP_INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_attendance_status is null or p_attendance_status not in ('attending', 'declining') then
    raise exception 'RSVP_INVALID: attendance' using errcode = '22023';
  end if;

  if p_attendance_status = 'attending' then
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

    v_coming_from := nullif(regexp_replace(btrim(coalesce(p_coming_from, '')), '\s+', ' ', 'g'), '');
    if v_coming_from is null or char_length(v_coming_from) > 120 then
      raise exception 'RSVP_INVALID: coming_from' using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct f order by f), '{}') into v_food from unnest(coalesce(p_food_preferences, '{}')) as f;
    if cardinality(v_food) > 4 or not (v_food <@ array['vegetable', 'pasta', 'fish', 'pork', 'beef', 'chicken']::text[]) then
      raise exception 'RSVP_INVALID: food_preferences' using errcode = '22023';
    end if;

    if p_has_food_restrictions is null then
      raise exception 'RSVP_INVALID: has_food_restrictions' using errcode = '22023';
    end if;
    if p_has_food_restrictions then
      v_restrictions := nullif(btrim(coalesce(p_food_restrictions, '')), '');
      if v_restrictions is null or char_length(v_restrictions) > 120 then
        raise exception 'RSVP_INVALID: food_restrictions' using errcode = '22023';
      end if;
    end if;

    v_access := nullif(btrim(coalesce(p_accessibility_needs, '')), '');
    if v_access is not null and char_length(v_access) > 255 then
      raise exception 'RSVP_INVALID: accessibility_needs' using errcode = '22023';
    end if;

    v_message := nullif(btrim(coalesce(p_message_to_couple, '')), '');
    if v_message is not null and char_length(v_message) > 500 then
      raise exception 'RSVP_INVALID: message_to_couple' using errcode = '22023';
    end if;

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
      -- A name the couple already included is not a new request.
      if not exists (select 1 from public.additional_guests ag
                     where ag.invitation_id = v_invitation.id and ag.added_by = 'admin'
                       and public.normalize_name(ag.guest_name) = public.normalize_name(v_name)) then
        v_guests := array_append(v_guests, v_name);
      end if;
    end loop;

    if cardinality(v_guests) > v_invitation.max_additional_guests then
      raise exception 'RSVP_INVALID: too_many_guests' using errcode = '22023';
    end if;
  end if;

  insert into public.rsvp_responses as r (
    invitation_id, attendance_status, has_transportation, needs_transportation,
    vehicle_type, coming_from, food_preferences, has_food_restrictions,
    food_restrictions, accessibility_needs, bringing_additional_guest,
    message_to_couple, submitted_at, updated_at
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
    case when p_attendance_status = 'attending' then v_message end,
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
    bringing_additional_guest = excluded.bringing_additional_guest,
    message_to_couple         = excluded.message_to_couple
  returning r.id into v_rsvp_id;

  -- Reconcile ONLY the guest's own requests; admin-included guests are untouched.
  delete from public.additional_guests ag
  where ag.invitation_id = v_invitation.id
    and ag.added_by = 'invitee'
    and (ag.rsvp_response_id <> v_rsvp_id
         or not exists (select 1 from unnest(v_guests) g where public.normalize_name(g) = public.normalize_name(ag.guest_name)));

  insert into public.additional_guests (invitation_id, rsvp_response_id, guest_name, status, added_by)
  select v_invitation.id, v_rsvp_id, g, 'pending', 'invitee'
  from unnest(v_guests) g
  where not exists (
    select 1 from public.additional_guests ag
    where ag.invitation_id = v_invitation.id and public.normalize_name(ag.guest_name) = public.normalize_name(g));

  return query select v_rsvp_id, p_attendance_status;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. admin_set_included_guests — the couple's own guest list per invitation.
--    Included guests are approved automatically. If a name matches a guest the
--    invitee already requested, that request is converted and approved.
-- -----------------------------------------------------------------------------
drop function if exists public.admin_set_included_guests(uuid, text[]);
create function public.admin_set_included_guests(p_invitation_id uuid, p_names text[])
returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_names text[] := '{}';
  v_name  text;
  v_count integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.invitations where id = p_invitation_id) then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  foreach v_name in array coalesce(p_names, '{}') loop
    v_name := regexp_replace(btrim(coalesce(v_name, '')), '\s+', ' ', 'g');
    continue when v_name = '';
    if char_length(v_name) > 150 then
      raise exception 'GUEST_NAME_TOO_LONG' using errcode = '22023';
    end if;
    if not exists (select 1 from unnest(v_names) n where public.normalize_name(n) = public.normalize_name(v_name)) then
      v_names := array_append(v_names, v_name);
    end if;
  end loop;

  if cardinality(v_names) > 20 then
    raise exception 'TOO_MANY_INCLUDED_GUESTS' using errcode = '22023';
  end if;

  -- Remove included guests no longer listed.
  delete from public.additional_guests ag
  where ag.invitation_id = p_invitation_id and ag.added_by = 'admin'
    and not exists (select 1 from unnest(v_names) n where public.normalize_name(n) = public.normalize_name(ag.guest_name));

  -- A matching guest request becomes an included, approved guest.
  update public.additional_guests ag
  set added_by = 'admin', status = 'approved', guest_name = n.name
  from unnest(v_names) as n(name)
  where ag.invitation_id = p_invitation_id and ag.added_by = 'invitee'
    and public.normalize_name(ag.guest_name) = public.normalize_name(n.name);

  -- Update spelling of existing included guests, insert new ones.
  update public.additional_guests ag
  set guest_name = n.name
  from unnest(v_names) as n(name)
  where ag.invitation_id = p_invitation_id and ag.added_by = 'admin'
    and public.normalize_name(ag.guest_name) = public.normalize_name(n.name)
    and ag.guest_name <> n.name;

  insert into public.additional_guests (invitation_id, rsvp_response_id, guest_name, status, added_by)
  select p_invitation_id, null, n.name, 'approved', 'admin'
  from unnest(v_names) as n(name)
  where not exists (
    select 1 from public.additional_guests ag
    where ag.invitation_id = p_invitation_id and public.normalize_name(ag.guest_name) = public.normalize_name(n.name));

  select count(*) into v_count from public.additional_guests
  where invitation_id = p_invitation_id and added_by = 'admin';

  insert into public.admin_activity_logs (admin_user_id, action, target_table, target_id, details)
  values (auth.uid(), 'included_guests_updated', 'invitations', p_invitation_id,
          jsonb_build_object('included_guests', to_jsonb(v_names)));

  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Activity log: outfit images added/removed
-- -----------------------------------------------------------------------------
create or replace function public.log_outfit_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    return coalesce(new, old);
  end if;
  insert into public.admin_activity_logs (admin_user_id, action, target_table, target_id, details)
  values (
    auth.uid(),
    case when tg_op = 'INSERT' then 'outfit_image_added' else 'outfit_image_removed' end,
    'outfit_images',
    coalesce(new.id, old.id),
    jsonb_build_object('gender', coalesce(new.gender, old.gender), 'caption', coalesce(new.caption, old.caption))
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists outfit_images_activity_log on public.outfit_images;
create trigger outfit_images_activity_log after insert or delete on public.outfit_images
  for each row execute function public.log_outfit_activity();

-- -----------------------------------------------------------------------------
-- 8. Function permissions
-- -----------------------------------------------------------------------------
revoke execute on function public.find_invitation(text) from public;
revoke execute on function public.find_invitation_by_code(text) from public;
revoke execute on function public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text) from public;
revoke execute on function public.admin_set_included_guests(uuid, text[]) from public, anon;
revoke execute on function public.log_outfit_activity() from public, anon, authenticated;

grant execute on function public.find_invitation(text) to anon, authenticated;
grant execute on function public.find_invitation_by_code(text) to anon, authenticated;
grant execute on function public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text) to anon, authenticated;
grant execute on function public.admin_set_included_guests(uuid, text[]) to authenticated;
