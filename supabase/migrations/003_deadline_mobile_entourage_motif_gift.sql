-- =============================================================================
--  MIGRATION 003 — RSVP deadline, mobile number, entourage, motif colours,
--                  private wedding-gift QR
--  Run AFTER 002. Safe to re-run. (Already applied to the live project.)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Website settings: RSVP deadline, entourage, motif
-- -----------------------------------------------------------------------------
alter table public.wedding_settings
  add column if not exists rsvp_deadline timestamptz,
  add column if not exists rsvp_open boolean not null default true,
  add column if not exists rsvp_closed_message text
    default 'Our RSVP list is now closed. For any changes, please reach out to us directly — we would love to hear from you.',
  add column if not exists entourage jsonb not null default '[]'::jsonb,
  add column if not exists entourage_visible boolean not null default true,
  add column if not exists entourage_title text default 'The Entourage',
  add column if not exists entourage_subtitle text default 'With gratitude to the people who will stand beside us.',
  add column if not exists motif_title text default 'Our Motif',
  add column if not exists motif_colors jsonb not null default '[]'::jsonb;

alter table public.wedding_settings drop constraint if exists wedding_settings_entourage_is_array;
alter table public.wedding_settings add constraint wedding_settings_entourage_is_array
  check (jsonb_typeof(entourage) = 'array');
alter table public.wedding_settings drop constraint if exists wedding_settings_motif_is_array;
alter table public.wedding_settings add constraint wedding_settings_motif_is_array
  check (jsonb_typeof(motif_colors) = 'array' and jsonb_array_length(motif_colors) <= 12);

-- Sample motif + sample entourage (replace in Admin). Only filled when empty.
update public.wedding_settings
set motif_colors = '[
  {"id":"m1","name":"Champagne","hex":"#D8C3A0"},
  {"id":"m2","name":"Sage","hex":"#9FAC97"},
  {"id":"m3","name":"Dusty Rose","hex":"#C9A19A"},
  {"id":"m4","name":"Taupe","hex":"#A8977A"},
  {"id":"m5","name":"Ivory","hex":"#F3EBDD"}
]'::jsonb
where jsonb_array_length(motif_colors) = 0;

update public.wedding_settings
set entourage = '[
  {"id":"g-parents-groom","title":"Parents of the Groom","layout":"pairs","members":[
    {"id":"p1","name":"Mr. Sample Father","role":""},{"id":"p2","name":"Mrs. Sample Mother","role":""}]},
  {"id":"g-parents-bride","title":"Parents of the Bride","layout":"pairs","members":[
    {"id":"p3","name":"Mr. Sample Father","role":""},{"id":"p4","name":"Mrs. Sample Mother","role":""}]},
  {"id":"g-principal","title":"Principal Sponsors","layout":"pairs","members":[
    {"id":"p5","name":"Mr. Antonio Reyes","role":""},{"id":"p6","name":"Mrs. Liza Reyes","role":""},
    {"id":"p7","name":"Mr. Ramon Cruz","role":""},{"id":"p8","name":"Mrs. Elena Cruz","role":""}]},
  {"id":"g-best-man","title":"Best Man","layout":"list","members":[{"id":"p9","name":"Sample Best Man","role":""}]},
  {"id":"g-maid","title":"Maid of Honor","layout":"list","members":[{"id":"p10","name":"Sample Maid of Honor","role":""}]},
  {"id":"g-secondary","title":"Secondary Sponsors","layout":"pairs","members":[
    {"id":"p11","name":"Sample Name","role":"Candle"},{"id":"p12","name":"Sample Name","role":"Candle"},
    {"id":"p13","name":"Sample Name","role":"Veil"},{"id":"p14","name":"Sample Name","role":"Veil"},
    {"id":"p15","name":"Sample Name","role":"Cord"},{"id":"p16","name":"Sample Name","role":"Cord"}]},
  {"id":"g-groomsmen","title":"Groomsmen","layout":"pairs","members":[
    {"id":"p17","name":"Sample Groomsman","role":""},{"id":"p18","name":"Sample Groomsman","role":""}]},
  {"id":"g-bridesmaids","title":"Bridesmaids","layout":"pairs","members":[
    {"id":"p19","name":"Sample Bridesmaid","role":""},{"id":"p20","name":"Sample Bridesmaid","role":""}]},
  {"id":"g-bearers","title":"Bearers","layout":"list","members":[
    {"id":"p21","name":"Sample Name","role":"Ring"},{"id":"p22","name":"Sample Name","role":"Coin"},{"id":"p23","name":"Sample Name","role":"Bible"}]},
  {"id":"g-flower","title":"Flower Girls","layout":"pairs","members":[
    {"id":"p24","name":"Sample Flower Girl","role":""},{"id":"p25","name":"Sample Flower Girl","role":""}]}
]'::jsonb
where jsonb_array_length(entourage) = 0;

create or replace function public.rsvp_is_open()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select s.rsvp_open and (s.rsvp_deadline is null or now() < s.rsvp_deadline)
     from public.wedding_settings s limit 1),
    true);
$$;

-- -----------------------------------------------------------------------------
-- 2. Mobile number on RSVP responses (Philippine mobile, stored as +639XXXXXXXXX)
-- -----------------------------------------------------------------------------
alter table public.rsvp_responses add column if not exists mobile_number varchar(20);
alter table public.rsvp_responses drop constraint if exists rsvp_mobile_number_format;
alter table public.rsvp_responses add constraint rsvp_mobile_number_format
  check (mobile_number is null or mobile_number ~ '^\+639[0-9]{9}$');

-- Accepts 09XXXXXXXXX, 9XXXXXXXXX, 639XXXXXXXXX, +63 9XX XXX XXXX (spaces/dashes ok).
create or replace function public.normalize_ph_mobile(p_value text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v text := regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g');
begin
  if v ~ '^639[0-9]{9}$' then return '+' || v; end if;
  if v ~ '^09[0-9]{9}$' then return '+63' || substr(v, 2); end if;
  if v ~ '^9[0-9]{9}$' then return '+63' || v; end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Wedding gift QR — NOT publicly readable; exposed only through RPCs
-- -----------------------------------------------------------------------------
create table if not exists public.gift_settings (
  singleton    boolean primary key default true check (singleton),
  is_visible   boolean not null default false,
  placement    text not null default 'private',
  title        text default 'Wedding Gift',
  message      text default 'Your presence is the greatest gift of all. Should you wish to bless us further, you may scan the code below.',
  qr_image_url text,
  updated_at   timestamptz not null default now(),
  constraint gift_settings_placement_valid check (placement in ('private', 'public')),
  constraint gift_settings_qr_url_valid check (qr_image_url is null or qr_image_url ~* '^https://')
);
insert into public.gift_settings (singleton) values (true) on conflict do nothing;

drop trigger if exists gift_settings_updated_at on public.gift_settings;
create trigger gift_settings_updated_at before update on public.gift_settings
  for each row execute function public.set_updated_at();

alter table public.gift_settings enable row level security;
drop policy if exists "Admins can read gift settings" on public.gift_settings;
create policy "Admins can read gift settings" on public.gift_settings for select to authenticated using (public.is_admin());
drop policy if exists "Admins can update gift settings" on public.gift_settings;
create policy "Admins can update gift settings" on public.gift_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.gift_settings from anon;
grant select, update on public.gift_settings to authenticated;

-- Home page (only when the couple chose "public").
drop function if exists public.get_public_gift();
create function public.get_public_gift()
returns table (title text, message text, qr_image_url text)
language sql stable security definer set search_path = ''
as $$
  select g.title, g.message, g.qr_image_url from public.gift_settings g
  where g.is_visible and g.placement = 'public' and g.qr_image_url is not null;
$$;

-- Invited guests, after they found their invitation (private or public).
drop function if exists public.get_invitation_gift(uuid);
create function public.get_invitation_gift(p_invitation_id uuid)
returns table (title text, message text, qr_image_url text)
language sql stable security definer set search_path = ''
as $$
  select g.title, g.message, g.qr_image_url from public.gift_settings g
  where g.is_visible and g.qr_image_url is not null
    and exists (select 1 from public.invitations i where i.id = p_invitation_id and i.is_active);
$$;

-- Stop anonymous listing of the assets bucket (files stay viewable by URL,
-- but nobody can enumerate paths — e.g. the gift QR's unguessable file name).
drop policy if exists "Public can view wedding assets" on storage.objects;
drop policy if exists "Admins can list wedding assets" on storage.objects;
create policy "Admins can list wedding assets" on storage.objects for select to authenticated
  using (bucket_id = 'wedding-assets' and public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. submit_rsvp — deadline + required mobile number
-- -----------------------------------------------------------------------------
drop function if exists public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text);
drop function if exists public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text);
create function public.submit_rsvp(
  p_invitation_id uuid, p_attendance_status text,
  p_has_transportation boolean default null, p_needs_transportation text default null,
  p_vehicle_type text default null, p_coming_from text default null,
  p_food_preferences text[] default '{}', p_has_food_restrictions boolean default null,
  p_food_restrictions text default null, p_accessibility_needs text default null,
  p_additional_guests text[] default '{}', p_message_to_couple text default null,
  p_mobile_number text default null
)
returns table (rsvp_id uuid, attendance_status text)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_invitation public.invitations%rowtype;
  v_rsvp_id uuid;
  v_guests text[] := '{}';
  v_food text[] := '{}';
  v_name text;
  v_coming_from text;
  v_restrictions text;
  v_access text;
  v_message text;
  v_mobile text;
begin
  if not public.rsvp_is_open() then
    raise exception 'RSVP_CLOSED' using errcode = 'P0001';
  end if;

  select * into v_invitation from public.invitations where id = p_invitation_id and is_active for update;
  if not found then
    raise exception 'RSVP_INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_attendance_status is null or p_attendance_status not in ('attending', 'declining') then
    raise exception 'RSVP_INVALID: attendance' using errcode = '22023';
  end if;

  v_mobile := public.normalize_ph_mobile(p_mobile_number);
  if v_mobile is null then
    raise exception 'RSVP_INVALID: mobile_number' using errcode = '22023';
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
    message_to_couple, mobile_number, submitted_at, updated_at
  ) values (
    v_invitation.id, p_attendance_status,
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
    v_mobile,
    now(), now()
  )
  on conflict (invitation_id) do update set
    attendance_status = excluded.attendance_status,
    has_transportation = excluded.has_transportation,
    needs_transportation = excluded.needs_transportation,
    vehicle_type = excluded.vehicle_type,
    coming_from = excluded.coming_from,
    food_preferences = excluded.food_preferences,
    has_food_restrictions = excluded.has_food_restrictions,
    food_restrictions = excluded.food_restrictions,
    accessibility_needs = excluded.accessibility_needs,
    bringing_additional_guest = excluded.bringing_additional_guest,
    message_to_couple = excluded.message_to_couple,
    mobile_number = excluded.mobile_number
  returning r.id into v_rsvp_id;

  delete from public.additional_guests ag
  where ag.invitation_id = v_invitation.id and ag.added_by = 'invitee'
    and (ag.rsvp_response_id <> v_rsvp_id
         or not exists (select 1 from unnest(v_guests) g where public.normalize_name(g) = public.normalize_name(ag.guest_name)));

  insert into public.additional_guests (invitation_id, rsvp_response_id, guest_name, status, added_by)
  select v_invitation.id, v_rsvp_id, g, 'pending', 'invitee'
  from unnest(v_guests) g
  where not exists (select 1 from public.additional_guests ag
                    where ag.invitation_id = v_invitation.id and public.normalize_name(ag.guest_name) = public.normalize_name(g));

  return query select v_rsvp_id, p_attendance_status;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Activity log: gift settings changes
-- -----------------------------------------------------------------------------
create or replace function public.log_gift_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_fields jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    return new;
  end if;
  select coalesce(jsonb_agg(n.key), '[]'::jsonb) into v_fields
  from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
  where n.value is distinct from o.value and n.key <> 'updated_at';
  insert into public.admin_activity_logs (admin_user_id, action, target_table, target_id, details)
  values (auth.uid(), 'gift_settings_updated', 'gift_settings', null, jsonb_build_object('changed_fields', v_fields));
  return new;
end;
$$;
drop trigger if exists gift_settings_activity_log on public.gift_settings;
create trigger gift_settings_activity_log after update on public.gift_settings
  for each row execute function public.log_gift_activity();

-- -----------------------------------------------------------------------------
-- 6. Function permissions
-- -----------------------------------------------------------------------------
revoke execute on function public.rsvp_is_open() from public;
revoke execute on function public.normalize_ph_mobile(text) from public;
revoke execute on function public.get_public_gift() from public;
revoke execute on function public.get_invitation_gift(uuid) from public;
revoke execute on function public.log_gift_activity() from public, anon, authenticated;
revoke execute on function public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text) from public;

grant execute on function public.rsvp_is_open() to anon, authenticated;
grant execute on function public.get_public_gift() to anon, authenticated;
grant execute on function public.get_invitation_gift(uuid) to anon, authenticated;
grant execute on function public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text) to anon, authenticated;
