-- Baby Shower Websites — database update (run once in Supabase → SQL Editor → New query → paste → Run).
-- 046: many showers, plans, logins, per-shower security.  047: discounts on plans.
-- It runs as one block: if anything fails, nothing is changed.

-- =============================================================================
--  046 — One website, many baby showers ("spaces")
--
--  What this adds
--    * plans      — Little Sprout / Sweet Bundle / Full Celebration: price,
--                   guest limit and the features each one includes.
--    * spaces     — one row per customer's baby shower: web address (slug),
--                   plan, on/off switch and end date. The shower that was
--                   already here becomes the default space, so nothing that
--                   exists today changes.
--    * accounts   — one row per login: username, name, super-admin flag.
--                   Passwords are NOT stored here: Supabase Auth keeps them
--                   (hashed). Logins are created by the super admin through
--                   the "owner-users" Edge Function.
--    * space_id   — on every table. The database itself keeps every space's
--                   rows apart (restrictive row-level security), so a page or
--                   function can never read or change another space's data.
--
--  How the space is chosen
--    The website sends the space's web address in an "x-space" request header.
--    With no header (the website as it is today) the default space is used.
--    An unknown address matches nothing.
--
--  How it stays safe
--    * Every table gets a RESTRICTIVE policy: space_id = current space, and the
--      space must be switched on (or the caller is the super admin).
--    * The existing database functions are SECURITY DEFINER and were owned by
--      "postgres", which skips row-level security. They are handed to a new
--      role, "tenant_fn", which does NOT skip it — so every existing function
--      is automatically limited to the current space without rewriting it.
--    * Plan limits are checked by the database too (guest limit, looks,
--      co-hosts, and writes to features the plan doesn't include).
--
--  Safe to run once on the existing project. Take a backup first.
-- =============================================================================

begin;

-- Some helpers below refer to the space_id columns added in section 5.
set local check_function_bodies = off;

-- -----------------------------------------------------------------------------
-- 1. Plans
-- -----------------------------------------------------------------------------
create table if not exists public.plans (
  id           text primary key check (id ~ '^[a-z][a-z0-9_]{1,30}$'),
  name         text not null,
  tagline      text not null default '',
  price_php    integer not null check (price_php >= 0),
  guest_limit  integer check (guest_limit is null or guest_limit > 0),   -- null = unlimited
  features     text[] not null default '{}',
  highlight    boolean not null default false,
  sort         integer not null default 0,
  updated_at   timestamptz not null default now()
);
alter table public.plans enable row level security;
drop policy if exists "Anyone can read plans" on public.plans;
create policy "Anyone can read plans" on public.plans for select to anon, authenticated using (true);
grant select on public.plans to anon, authenticated;

-- Features every plan has: website, countdown, venue, RSVP, virtual invitation,
-- gift wishlist, program, What to Wear. The lists below are the extras.
insert into public.plans (id, name, tagline, price_php, guest_limit, features, highlight, sort) values
  ('sprout', 'Little Sprout', 'Everything you need to invite and RSVP', 999, 40,
     '{}', false, 1),
  ('bundle', 'Sweet Bundle', 'The full guest experience, games and all', 1999, 120,
     '{looks_all,predictions,names,reveal,guest_photos,gallery,printables}', true, 2),
  ('full', 'Full Celebration', 'Everything, plus the party-day fun', 3499, null,
     '{looks_all,predictions,names,reveal,guest_photos,gallery,printables,raffle,big_screen,slideshow,music,seating,cohost}', false, 3)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Spaces
-- -----------------------------------------------------------------------------
create table if not exists public.spaces (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  title         text not null check (length(btrim(title)) between 1 and 120),
  plan_id       text not null default 'sprout' references public.plans (id),
  is_active     boolean not null default false,
  active_until  date,
  is_default    boolean not null default false,
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists spaces_one_default on public.spaces ((true)) where is_default;
alter table public.spaces enable row level security;
drop trigger if exists spaces_updated_at on public.spaces;
create trigger spaces_updated_at before update on public.spaces for each row execute function public.set_updated_at();

-- The shower that is already here.
insert into public.spaces (id, slug, title, plan_id, is_active, is_default)
values ('00000000-0000-0000-0000-000000000001', 'mirella', 'Mir & Ella Baby Shower', 'full', true, true)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Accounts (logins). Passwords live in Supabase Auth, never here.
-- -----------------------------------------------------------------------------
create table if not exists public.accounts (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  username        text not null unique check (username ~ '^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$'),
  display_name    text not null default '',
  is_super_admin  boolean not null default false,
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);
alter table public.accounts enable row level security;

-- Whoever is an admin today becomes the super admin (username from their email).
insert into public.accounts (user_id, username, display_name, is_super_admin)
select x.user_id,
       case when x.u ~ '^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])$' then x.u else 'owner' end,
       '', true
from (
  select au.user_id,
         left(regexp_replace(lower(split_part(coalesce(au.email, u.email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'), 32) as u
  from public.admin_users au join auth.users u on u.id = au.user_id
) x
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------
-- 4. Helpers (owned by postgres on purpose: they look across spaces)
-- -----------------------------------------------------------------------------
create or replace function public.current_space_id()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare
  v_slug text;
  v_id uuid;
begin
  begin
    v_slug := nullif(lower(btrim(current_setting('request.headers', true)::json ->> 'x-space')), '');
  exception when others then
    v_slug := null;
  end;
  if v_slug is null then
    select s.id into v_id from public.spaces s where s.is_default;
  else
    select s.id into v_id from public.spaces s where s.slug = v_slug;
    v_id := coalesce(v_id, '00000000-0000-0000-0000-000000000000'::uuid);  -- unknown address: matches nothing
  end if;
  return v_id;
end;
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.accounts a where a.user_id = auth.uid() and a.is_super_admin);
$$;

create or replace function public.space_is_open(p_space uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = p_space and s.is_active
      and (s.active_until is null or s.active_until >= (now() at time zone 'Asia/Manila')::date)
  );
$$;

-- The current space may be used: it is switched on, or the caller is the super admin.
create or replace function public.current_space_ok()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.space_is_open(public.current_space_id()) or public.is_super_admin();
$$;

-- Admin of a given space (used by storage, where no space header is sent).
create or replace function public.is_space_admin(p_space uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_super_admin() or (
    public.space_is_open(p_space)
    and exists (select 1 from public.admin_users au where au.space_id = p_space and au.user_id = auth.uid())
  );
$$;

-- Does a space's plan include a feature?
create or replace function public.plan_allows(p_space uuid, p_feature text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.spaces s join public.plans p on p.id = s.plan_id
    where s.id = p_space and p_feature = any (p.features)
  );
$$;

grant execute on function public.current_space_id(), public.is_super_admin(), public.space_is_open(uuid),
  public.current_space_ok(), public.is_space_admin(uuid), public.plan_allows(uuid, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 5. space_id on every table
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'additional_guests','admin_activity_logs','admin_preferences','admin_users','baby_predictions',
    'entourage_links','gallery_images','gender_reveal','gift_settings','guest_photo_sessions','guest_photos',
    'invitation_opens','invitations','media_sections','name_suggestions','outfit_images','program_items',
    'raffle_draws','raffle_host','raffle_host_sessions','registry_claims','registry_items','rsvp_questions',
    'rsvp_responses','seat_assignments','seating_items','seating_notices','seating_tables','wedding_settings'
  ] loop
    execute format('alter table public.%I add column if not exists space_id uuid not null default public.current_space_id() references public.spaces (id) on delete cascade', t);
    execute format('create index if not exists %I on public.%I (space_id)', t || '_space_idx', t);
  end loop;
end $$;

-- Keys that must now be unique per space rather than across the whole database.
alter table public.admin_preferences drop constraint if exists admin_preferences_pkey;
alter table public.admin_preferences add primary key (space_id, key);

alter table public.admin_users drop constraint if exists admin_users_pkey;
alter table public.admin_users add primary key (space_id, user_id);

alter table public.entourage_links drop constraint if exists entourage_links_pkey;
alter table public.entourage_links add primary key (space_id, member_id);

alter table public.gender_reveal drop constraint if exists gender_reveal_pkey;
alter table public.gender_reveal add primary key (space_id, id);

alter table public.gift_settings drop constraint if exists gift_settings_pkey;
alter table public.gift_settings add primary key (space_id, singleton);

alter table public.raffle_host drop constraint if exists raffle_host_pkey;
alter table public.raffle_host add primary key (space_id, id);

alter table public.wedding_settings drop constraint if exists wedding_settings_singleton_key;
alter table public.wedding_settings add constraint wedding_settings_space_singleton_key unique (space_id, singleton);

alter table public.invitations drop constraint if exists invitations_invitation_code_key;
alter table public.invitations add constraint invitations_space_code_key unique (space_id, invitation_code);

drop index if exists public.invitations_active_search_name_uniq;
create unique index invitations_active_search_name_uniq on public.invitations (space_id, search_name) where is_active;

drop index if exists public.seating_tables_name_uq;
create unique index seating_tables_name_uq on public.seating_tables (space_id, lower(btrim((name)::text)));

-- -----------------------------------------------------------------------------
-- 6. The tenant_fn role: runs the existing functions WITH row-level security
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'tenant_fn') then
    create role tenant_fn nologin nobypassrls;
  end if;
end $$;
grant authenticated to tenant_fn;          -- same table rights and auth.uid() as a signed-in user
grant tenant_fn to postgres;               -- lets postgres hand functions over
grant usage, create on schema public to tenant_fn;
grant select, insert, update, delete on all tables in schema public to tenant_fn;
grant usage, select on all sequences in schema public to tenant_fn;
grant execute on all functions in schema public to tenant_fn;
alter default privileges in schema public grant select, insert, update, delete on tables to tenant_fn;
alter default privileges in schema public grant usage, select on sequences to tenant_fn;

-- -----------------------------------------------------------------------------
-- 7. Row-level security: every table is limited to the current space
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'additional_guests','admin_activity_logs','admin_preferences','admin_users','baby_predictions',
    'entourage_links','gallery_images','gender_reveal','gift_settings','guest_photo_sessions','guest_photos',
    'invitation_opens','invitations','media_sections','name_suggestions','outfit_images','program_items',
    'raffle_draws','raffle_host','raffle_host_sessions','registry_claims','registry_items','rsvp_questions',
    'rsvp_responses','seat_assignments','seating_items','seating_notices','seating_tables','wedding_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Only this space" on public.%I', t);
    execute format($p$create policy "Only this space" on public.%I as restrictive for all to public
      using (space_id = (select public.current_space_id()) and (select public.current_space_ok()))
      with check (space_id = (select public.current_space_id()) and (select public.current_space_ok()))$p$, t);
    -- The database functions see the whole space (as they always did) — but only this space.
    execute format('drop policy if exists "Database functions" on public.%I', t);
    execute format('create policy "Database functions" on public.%I for all to tenant_fn using (true) with check (true)', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 8. Admins are per space
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_super_admin() or (
    public.space_is_open(public.current_space_id())
    and exists (
      select 1 from public.admin_users au
      where au.user_id = auth.uid() and au.space_id = public.current_space_id()
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- 9. Existing functions: per-space conflict keys and live-photo channel
-- -----------------------------------------------------------------------------
-- Slideshow refresh signal: one channel per space (the default space keeps the old name).
create or replace function public.guest_photo_topic()
returns text language sql stable security definer set search_path = ''
as $$
  select case when s.is_default then 'guest-photos' else 'guest-photos:' || s.slug end
  from public.spaces s where s.id = public.current_space_id();
$$;
grant execute on function public.guest_photo_topic() to anon, authenticated, tenant_fn;

do $$
declare
  r record;
  d text;
  n text;
begin
  for r in
    select p.oid, pg_get_functiondef(p.oid) as def
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
      and (pg_get_functiondef(p.oid) ~* 'on conflict \((key|id)\)' or pg_get_functiondef(p.oid) ~ $q$'guest-photos', false\)$q$)
  loop
    d := r.def;
    n := regexp_replace(d, 'on conflict \(key\)', 'on conflict (space_id, key)', 'gi');
    n := regexp_replace(n, 'on conflict \(id\)', 'on conflict (space_id, id)', 'gi');
    n := replace(n, $q$'guest-photos', false)$q$, $q$coalesce(public.guest_photo_topic(), 'guest-photos'), false)$q$);
    if n <> d then
      execute n;
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 10. Hand the existing SECURITY DEFINER functions to tenant_fn
--     (the helpers above stay with postgres: they must look across spaces)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and p.prosecdef
      and pg_get_userbyid(p.proowner) = 'postgres'
      and p.proname not in (
        'current_space_id','is_super_admin','space_is_open','current_space_ok','is_space_admin','plan_allows',
        'is_admin','guest_photo_topic','guest_photo_slot_ok'
      )
  loop
    execute format('alter function %s owner to tenant_fn', r.sig);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 11. Plan limits, checked by the database
-- -----------------------------------------------------------------------------
-- Writes to a feature the plan doesn't include are refused (reading stays possible,
-- so an upgraded/downgraded space never "loses" what guests already sent).
-- guest_photo_sessions is the guest pass shared by the wishlist, games and photos,
-- so it isn't gated.
do $$
declare
  pair text[];
begin
  foreach pair slice 1 in array array[
    array['baby_predictions','predictions'],
    array['name_suggestions','names'],
    array['gender_reveal','reveal'],
    array['guest_photos','guest_photos'],
    array['gallery_images','gallery'],
    array['media_sections','gallery'],
    array['raffle_draws','raffle'],
    array['raffle_host','raffle'],
    array['raffle_host_sessions','raffle'],
    array['seating_tables','seating'],
    array['seating_items','seating'],
    array['seat_assignments','seating']
  ] loop
    execute format('drop policy if exists "Plan includes it (add)" on public.%I', pair[1]);
    execute format('create policy "Plan includes it (add)" on public.%I as restrictive for insert to public with check (public.plan_allows(space_id, %L))', pair[1], pair[2]);
    execute format('drop policy if exists "Plan includes it (change)" on public.%I', pair[1]);
    execute format('create policy "Plan includes it (change)" on public.%I as restrictive for update to public using (true) with check (public.plan_allows(space_id, %L))', pair[1], pair[2]);
  end loop;
end $$;

-- Guest limit: active invitations per space.
create or replace function public.enforce_plan_guest_limit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_limit int;
  v_count int;
begin
  if not new.is_active then
    return new;
  end if;
  select p.guest_limit into v_limit
  from public.spaces s join public.plans p on p.id = s.plan_id where s.id = new.space_id;
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count from public.invitations i
  where i.space_id = new.space_id and i.is_active and i.id <> new.id;
  if v_count >= v_limit then
    raise exception 'Your plan allows up to % guests. Message us to upgrade.', v_limit
      using errcode = 'P0001', hint = 'plan_guest_limit';
  end if;
  return new;
end;
$$;
drop trigger if exists invitations_plan_guest_limit on public.invitations;
create trigger invitations_plan_guest_limit before insert or update of is_active, space_id on public.invitations
  for each row execute function public.enforce_plan_guest_limit();

-- Looks: Little Sprout keeps the Clouds look (any colour) or the classic style.
create or replace function public.enforce_plan_look()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_template text := coalesce(new.theme ->> 'template', 'classic');
begin
  if (tg_op = 'UPDATE' and new.theme is not distinct from old.theme) then
    return new;
  end if;
  if not public.plan_allows(new.space_id, 'looks_all') and v_template !~ '^(classic|clouds-)' then
    raise exception 'This look is part of the Sweet Bundle and Full Celebration plans.'
      using errcode = 'P0001', hint = 'plan_feature:looks_all';
  end if;
  return new;
end;
$$;
drop trigger if exists wedding_settings_plan_look on public.wedding_settings;
create trigger wedding_settings_plan_look before insert or update of theme on public.wedding_settings
  for each row execute function public.enforce_plan_look();

-- Co-hosts: one admin per space unless the plan includes co-hosts.
create or replace function public.enforce_plan_cohost()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public.plan_allows(new.space_id, 'cohost')
     and exists (select 1 from public.admin_users au where au.space_id = new.space_id and au.user_id <> new.user_id) then
    raise exception 'Co-host logins are part of the Full Celebration plan.'
      using errcode = 'P0001', hint = 'plan_feature:cohost';
  end if;
  return new;
end;
$$;
drop trigger if exists admin_users_plan_cohost on public.admin_users;
create trigger admin_users_plan_cohost before insert or update on public.admin_users
  for each row execute function public.enforce_plan_cohost();

-- -----------------------------------------------------------------------------
-- 12. Storage: files live in a folder per space
-- -----------------------------------------------------------------------------
-- wedding-assets: new files go under "<space id>/…". Older files (no folder)
-- belong to the default space.
create or replace function public.asset_space(p_name text)
returns uuid language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select s.id from public.spaces s
      where split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and s.id = split_part(p_name, '/', 1)::uuid),
    (select s.id from public.spaces s where s.is_default)
  );
$$;

-- guest-photos: file names are random and recorded in guest_photos.
create or replace function public.guest_photo_file_space(p_name text)
returns uuid language sql stable security definer set search_path = ''
as $$
  select p.space_id from public.guest_photos p where p.path = p_name or p.thumb_path = p_name limit 1;
$$;
grant execute on function public.asset_space(text), public.guest_photo_file_space(text) to anon, authenticated;

drop policy if exists "Admins can upload wedding assets" on storage.objects;
create policy "Admins can upload wedding assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'wedding-assets' and public.is_space_admin(public.asset_space(name)));
drop policy if exists "Admins can update wedding assets" on storage.objects;
create policy "Admins can update wedding assets" on storage.objects for update to authenticated
  using (bucket_id = 'wedding-assets' and public.is_space_admin(public.asset_space(name)))
  with check (bucket_id = 'wedding-assets' and public.is_space_admin(public.asset_space(name)));
drop policy if exists "Admins can delete wedding assets" on storage.objects;
create policy "Admins can delete wedding assets" on storage.objects for delete to authenticated
  using (bucket_id = 'wedding-assets' and public.is_space_admin(public.asset_space(name)));
drop policy if exists "Admins can list wedding assets" on storage.objects;
create policy "Admins can list wedding assets" on storage.objects for select to authenticated
  using (bucket_id = 'wedding-assets' and public.is_space_admin(public.asset_space(name)));
drop policy if exists "Admins remove guest photo files" on storage.objects;
create policy "Admins remove guest photo files" on storage.objects for delete to authenticated
  using (bucket_id = 'guest-photos' and public.is_space_admin(public.guest_photo_file_space(name)));
-- The photo functions check uploaded files' sizes.
drop policy if exists "Database functions read guest photo files" on storage.objects;
create policy "Database functions read guest photo files" on storage.objects for select to tenant_fn
  using (bucket_id = 'guest-photos');

-- -----------------------------------------------------------------------------
-- 13. Space information for the website
-- -----------------------------------------------------------------------------
-- Guests: does this web address exist and is it open? (No private details.)
create or replace function public.space_public(p_slug text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
        'exists', true, 'id', s.id, 'slug', s.slug, 'title', s.title,
        'open', public.space_is_open(s.id),
        'features', (select to_jsonb(p.features) from public.plans p where p.id = s.plan_id))
     from public.spaces s where s.slug = lower(btrim(p_slug))),
    jsonb_build_object('exists', false));
$$;
grant execute on function public.space_public(text) to anon, authenticated;

-- The space this page is for (from the x-space header; the default space without one).
create or replace function public.space_here()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
        'exists', true, 'id', s.id, 'slug', s.slug, 'title', s.title, 'isDefault', s.is_default,
        'open', public.space_is_open(s.id), 'activeUntil', s.active_until,
        'plan', jsonb_build_object('id', p.id, 'name', p.name, 'guestLimit', p.guest_limit, 'features', to_jsonb(p.features)),
        'guests', case when public.is_admin() then
                    (select count(*) from public.invitations i where i.space_id = s.id and i.is_active) end)
     from public.spaces s join public.plans p on p.id = s.plan_id
     where s.id = public.current_space_id()),
    jsonb_build_object('exists', false));
$$;
grant execute on function public.space_here() to anon, authenticated;

-- Signed in: who am I, and which showers can I manage?
create or replace function public.my_account()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return null;
  end if;
  return jsonb_build_object(
    'username', (select a.username from public.accounts a where a.user_id = v_uid),
    'displayName', (select a.display_name from public.accounts a where a.user_id = v_uid),
    'superAdmin', public.is_super_admin(),
    'spaces', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id, 'slug', s.slug, 'title', s.title, 'isActive', s.is_active, 'activeUntil', s.active_until,
          'open', public.space_is_open(s.id),
          'plan', jsonb_build_object('id', p.id, 'name', p.name, 'guestLimit', p.guest_limit, 'features', to_jsonb(p.features)),
          'guests', (select count(*) from public.invitations i where i.space_id = s.id and i.is_active))
        order by s.created_at)
      from public.spaces s join public.plans p on p.id = s.plan_id
      where exists (select 1 from public.admin_users au where au.space_id = s.id and au.user_id = v_uid)
    ), '[]'::jsonb)
  );
end;
$$;
grant execute on function public.my_account() to authenticated;

-- Note a successful sign-in (shown on the owner page).
create or replace function public.touch_last_login()
returns void language sql volatile security definer set search_path = ''
as $$
  update public.accounts set last_login_at = now() where user_id = auth.uid();
$$;
grant execute on function public.touch_last_login() to authenticated;

-- -----------------------------------------------------------------------------
-- 14. Owner (super admin) tools
-- -----------------------------------------------------------------------------
create or replace function public.owner_spaces()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'slug', s.slug, 'title', s.title, 'planId', s.plan_id, 'isActive', s.is_active,
      'activeUntil', s.active_until, 'isDefault', s.is_default, 'notes', s.notes, 'createdAt', s.created_at,
      'open', public.space_is_open(s.id),
      'guests', (select count(*) from public.invitations i where i.space_id = s.id and i.is_active),
      'replies', (select count(*) from public.rsvp_responses r where r.space_id = s.id),
      'admins', coalesce((
        select jsonb_agg(jsonb_build_object('userId', a.user_id, 'username', a.username,
                          'displayName', a.display_name, 'lastLoginAt', a.last_login_at) order by a.username)
        from public.admin_users au join public.accounts a on a.user_id = au.user_id
        where au.space_id = s.id), '[]'::jsonb))
      order by s.is_default desc, s.created_at desc)
    from public.spaces s), '[]'::jsonb);
end;
$$;
grant execute on function public.owner_spaces() to authenticated;

create or replace function public.owner_accounts()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', a.user_id, 'username', a.username, 'displayName', a.display_name,
      'superAdmin', a.is_super_admin, 'lastLoginAt', a.last_login_at, 'createdAt', a.created_at,
      'spaces', coalesce((select jsonb_agg(s.slug order by s.slug) from public.admin_users au
                            join public.spaces s on s.id = au.space_id where au.user_id = a.user_id), '[]'::jsonb))
      order by a.created_at desc)
    from public.accounts a), '[]'::jsonb);
end;
$$;
grant execute on function public.owner_accounts() to authenticated;

-- Create or update a space. A new space starts with its own settings rows.
create or replace function public.owner_save_space(
  p_id uuid, p_slug text, p_title text, p_plan text, p_active boolean, p_until date, p_notes text default ''
)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_slug text := lower(btrim(p_slug));
begin
  if not public.is_super_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.spaces (slug, title, plan_id, is_active, active_until, notes)
    values (v_slug, btrim(p_title), p_plan, coalesce(p_active, false), p_until, coalesce(p_notes, ''))
    returning id into v_id;

    insert into public.wedding_settings (space_id, couple_names, hero_title, hero_subtitle, story_text, closing_message, additional_info, theme)
    values (v_id, btrim(p_title), btrim(p_title), 'A baby shower',
      'A little one is on the way! Join us for an afternoon of games, sweet treats and lots of love as we get ready to welcome our baby.',
      'Thank you for showering our little one with love. We can''t wait to celebrate with you.',
      '[{"id": "dress-code", "title": "What to Wear", "icon": "shirt", "visible": true, "body": "Come comfy and colourful! Soft pastels are perfect."},
        {"id": "gifts", "title": "Gifts", "icon": "gift", "visible": true, "body": "Your presence is the best gift."}]'::jsonb,
      '{"template": "clouds-blue"}'::jsonb);
    insert into public.gift_settings (space_id) values (v_id);
    insert into public.gender_reveal (space_id, id) values (v_id, 1);
    insert into public.raffle_host (space_id, id) values (v_id, 1);
    insert into public.admin_preferences (space_id, key, value) values
      (v_id, 'registry', '{"mode": "visible", "title": "Gift Wishlist", "intro": "If you would like to bring a gift, here are a few things our little one needs. Tap “I’ll bring this” so nothing is doubled."}'::jsonb),
      (v_id, 'predictions', '{"mode": "visible"}'::jsonb),
      (v_id, 'names', '{"mode": "visible", "approval": "instant", "perGuest": 3}'::jsonb);
  else
    update public.spaces set
      slug = v_slug, title = btrim(p_title), plan_id = p_plan, is_active = coalesce(p_active, false),
      active_until = p_until, notes = coalesce(p_notes, '')
    where id = v_id;
    if not found then
      raise exception 'No such space' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;
grant execute on function public.owner_save_space(uuid, text, text, text, boolean, date, text) to authenticated;

-- Give a login access to a space (or take it away).
create or replace function public.owner_set_member(p_user uuid, p_space uuid, p_member boolean)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_member then
    insert into public.admin_users (space_id, user_id, email)
    select p_space, u.id, u.email from auth.users u where u.id = p_user
    on conflict (space_id, user_id) do nothing;
  else
    delete from public.admin_users where space_id = p_space and user_id = p_user;
  end if;
end;
$$;
grant execute on function public.owner_set_member(uuid, uuid, boolean) to authenticated;

-- New tables stay with postgres; everything else in public is per space now.
revoke all on public.spaces, public.accounts from anon, authenticated;
revoke all on public.spaces, public.accounts from tenant_fn;

commit;

begin;
-- =============================================================================
--  047 — Discounts on plans (needs 046)
--
--  The owner can put any plan on sale from the Owner page: a sale price, a
--  short label ("Holiday sale") and an optional last day. The sign-in & plans
--  page then shows the old price crossed out next to the sale price. When the
--  last day has passed the sale ends by itself.
-- =============================================================================

alter table public.plans add column if not exists sale_price_php integer check (sale_price_php is null or sale_price_php >= 0);
alter table public.plans add column if not exists sale_label text not null default '';
alter table public.plans add column if not exists sale_ends date;

-- Owner: change a plan's price, guest limit and sale.
create or replace function public.owner_save_plan(
  p_id text, p_price integer, p_guest_limit integer,
  p_sale_price integer, p_sale_label text, p_sale_ends date
)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_sale_price is not null and p_sale_price >= p_price then
    raise exception 'The sale price must be lower than the usual price.' using errcode = 'P0001', hint = 'plan_sale_price';
  end if;
  update public.plans set
    price_php = p_price,
    guest_limit = p_guest_limit,
    sale_price_php = p_sale_price,
    sale_label = left(btrim(coalesce(p_sale_label, '')), 40),
    sale_ends = p_sale_ends,
    updated_at = now()
  where id = p_id;
  if not found then
    raise exception 'No such plan' using errcode = 'P0002';
  end if;
end;
$$;
grant execute on function public.owner_save_plan(text, integer, integer, integer, text, date) to authenticated;
commit;

-- Check: should list 1 shower (mirella, full, on) and your login as the owner.
select s.slug, s.plan_id, s.is_active, (select string_agg(a.username || case when a.is_super_admin then ' (owner)' else '' end, ', ') from public.accounts a) as logins from public.spaces s;
