-- =============================================================================
--  049 — "How guests RSVP": Guest list or Open link (needs 046)
--
--  Each shower chooses ONE way:
--    list — the customer adds the invited names; only those can RSVP (as before)
--    open — one link for everyone: guests type their name and mobile number and
--           reply. Companions (up to the customer's limit, names required) wait
--           for the customer's approval, like any additional-guest request.
--
--  An open sign-up becomes a normal invitation (source = 'link'), so the
--  dashboard, guest list, headcount, seating, printables, raffle and the
--  attending-only pages all work as before. The same name again updates that
--  reply instead of adding a second entry.
--
--  The two never mix: a shower can only switch to "open" when it has no
--  customer-added names (the guard refuses otherwise). Nothing is deleted
--  automatically — the customer clears the list on purpose
--  (admin_clear_guest_list). Switching back to "list" keeps every sign-up.
--
--  Safe to run twice. Existing showers stay on "list".
-- =============================================================================

begin;

-- ------------------------------------------------------------------ 1. settings & source
alter table public.wedding_settings add column if not exists rsvp_mode text not null default 'list';
alter table public.wedding_settings drop constraint if exists wedding_settings_rsvp_mode_valid;
alter table public.wedding_settings add constraint wedding_settings_rsvp_mode_valid check (rsvp_mode in ('list', 'open'));

alter table public.wedding_settings add column if not exists open_rsvp_companions integer not null default 1;
alter table public.wedding_settings drop constraint if exists wedding_settings_open_companions_range;
alter table public.wedding_settings add constraint wedding_settings_open_companions_range check (open_rsvp_companions between 0 and 10);

-- Where an invitation came from: the customer's guest list, or the open link.
alter table public.invitations add column if not exists source text not null default 'list';
alter table public.invitations drop constraint if exists invitations_source_valid;
alter table public.invitations add constraint invitations_source_valid check (source in ('list', 'link'));

-- ------------------------------------------------------------------ 2. the guard
-- Switching to "open" needs an empty guest list (only sign-ups may remain).
create or replace function public.guard_rsvp_mode()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_listed int;
begin
  if new.rsvp_mode = 'open' and old.rsvp_mode is distinct from 'open' then
    select count(*) into v_listed from public.invitations i where i.space_id = new.space_id and i.source = 'list';
    if v_listed > 0 then
      raise exception 'Remove the % listed guests before switching to an open link.', v_listed
        using errcode = 'P0001', hint = 'rsvp_mode_list_not_empty';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists wedding_settings_guard_rsvp_mode on public.wedding_settings;
create trigger wedding_settings_guard_rsvp_mode before update of rsvp_mode on public.wedding_settings
  for each row execute function public.guard_rsvp_mode();

-- ------------------------------------------------------------------ 3. clear the guest list (customer, on purpose)
create or replace function public.admin_clear_guest_list()
returns integer language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  with gone as (delete from public.invitations where source = 'list' returning 1)
  select count(*) into v_count from gone;
  return v_count;
end;
$$;

-- ------------------------------------------------------------------ 4. open sign-up
-- The guest's name and mobile number, then exactly the same reply as an invited guest.
create or replace function public.open_rsvp_submit(
  p_name text, p_attendance_status text,
  p_has_transportation boolean default null, p_needs_transportation text default null,
  p_vehicle_type text default null, p_coming_from text default null,
  p_food_preferences text[] default '{}', p_has_food_restrictions boolean default null,
  p_food_restrictions text default null, p_accessibility_needs text default null,
  p_additional_guests text[] default '{}', p_message_to_couple text default null,
  p_mobile_number text default null, p_custom_answers jsonb default '{}'::jsonb
)
returns table (rsvp_id uuid, attendance_status text, invitation_id uuid)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_mode text;
  v_companions int;
  v_name text;
  v_inv uuid;
  v_source text;
begin
  select s.rsvp_mode, s.open_rsvp_companions into v_mode, v_companions from public.wedding_settings s limit 1;
  if coalesce(v_mode, 'list') <> 'open' then
    raise exception 'RSVP_INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.rsvp_is_open() then
    raise exception 'RSVP_CLOSED' using errcode = 'P0001';
  end if;

  v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  if char_length(v_name) < 3 or char_length(v_name) > 150 or v_name !~ '\S+ \S+' then
    raise exception 'RSVP_INVALID: name' using errcode = '22023';
  end if;
  -- Open sign-ups always leave a mobile number (the customer may not know them).
  if public.normalize_ph_mobile(p_mobile_number) is null then
    raise exception 'RSVP_INVALID: mobile_number' using errcode = '22023';
  end if;

  -- The same name again: update that reply, no second entry.
  select i.id, i.source into v_inv, v_source
  from public.invitations i
  where i.is_active and i.search_name = public.normalize_name(v_name)
  limit 1;

  if v_inv is null then
    insert into public.invitations (invitee_name, max_additional_guests, is_active, source, position_mode)
    values (v_name, coalesce(v_companions, 0), true, 'link', 'none')
    returning id into v_inv;
  elsif v_source = 'link' then
    -- Sign-ups follow the customer's current companion limit.
    update public.invitations set max_additional_guests = coalesce(v_companions, 0) where id = v_inv;
  end if;

  return query
  select s.rsvp_id, s.attendance_status, v_inv
  from public.submit_rsvp(
    v_inv, p_attendance_status, p_has_transportation, p_needs_transportation, p_vehicle_type, p_coming_from,
    p_food_preferences, p_has_food_restrictions, p_food_restrictions, p_accessibility_needs,
    p_additional_guests, p_message_to_couple, p_mobile_number, p_custom_answers) s;
end;
$$;

-- ------------------------------------------------------------------ 5. rights & owners
revoke all on function public.guard_rsvp_mode() from public, anon, authenticated;
revoke all on function public.admin_clear_guest_list() from public, anon;
grant execute on function public.admin_clear_guest_list() to authenticated;
revoke all on function public.open_rsvp_submit(text, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text, jsonb) from public;
grant execute on function public.open_rsvp_submit(text, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text, jsonb) to anon, authenticated;

-- Like every other database function: limited to the current shower.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'tenant_fn') then
    alter function public.guard_rsvp_mode() owner to tenant_fn;
    alter function public.admin_clear_guest_list() owner to tenant_fn;
    alter function public.open_rsvp_submit(text, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text, jsonb) owner to tenant_fn;
  end if;
end $$;

commit;
