-- =============================================================================
--  MIGRATION 007 — RSVP wording options
--  * rsvp_button_label: text on the RSVP buttons (e.g. "Confirm Attendance")
--  * rsvp_show_deadline: show/hide the "respond by <date, time>" line
--  * mobile number no longer required for guests who decline
--  Run AFTER 006. Safe to re-run.
-- =============================================================================

alter table public.wedding_settings
  add column if not exists rsvp_button_label varchar(30) not null default 'RSVP',
  add column if not exists rsvp_show_deadline boolean not null default true;
alter table public.wedding_settings drop constraint if exists wedding_settings_rsvp_button_label_not_blank;
alter table public.wedding_settings add constraint wedding_settings_rsvp_button_label_not_blank
  check (char_length(btrim(rsvp_button_label)) >= 1);

-- rsvp_responses.mobile_number is already nullable.

create or replace function public.submit_rsvp(
  p_invitation_id uuid, p_attendance_status text,
  p_has_transportation boolean default null, p_needs_transportation text default null,
  p_vehicle_type text default null, p_coming_from text default null,
  p_food_preferences text[] default '{}', p_has_food_restrictions boolean default null,
  p_food_restrictions text default null, p_accessibility_needs text default null,
  p_additional_guests text[] default '{}', p_message_to_couple text default null,
  p_mobile_number text default null, p_custom_answers jsonb default '{}'::jsonb
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
  v_custom jsonb;
  v_cfg jsonb;
  v_transport_on boolean;
  v_coming_on boolean;
  v_coming_req boolean;
  v_food_on boolean;
  v_dietary_on boolean;
  v_access_on boolean;
  v_message_on boolean;
  v_has_transport boolean;
  v_has_restrictions boolean;
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

  -- Mobile number: required when attending, optional when declining (but must be valid if given).
  v_mobile := public.normalize_ph_mobile(p_mobile_number);
  if v_mobile is null and (p_attendance_status = 'attending' or nullif(btrim(coalesce(p_mobile_number, '')), '') is not null) then
    raise exception 'RSVP_INVALID: mobile_number' using errcode = '22023';
  end if;

  select coalesce(rsvp_config -> 'builtins', '{}'::jsonb) into v_cfg from public.wedding_settings limit 1;
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  v_transport_on := coalesce((v_cfg #>> '{transportation,enabled}')::boolean, true);
  v_coming_on    := coalesce((v_cfg #>> '{comingFrom,enabled}')::boolean, true);
  v_coming_req   := coalesce((v_cfg #>> '{comingFrom,required}')::boolean, true);
  v_food_on      := coalesce((v_cfg #>> '{food,enabled}')::boolean, true);
  v_dietary_on   := coalesce((v_cfg #>> '{dietary,enabled}')::boolean, true);
  v_access_on    := coalesce((v_cfg #>> '{accessibility,enabled}')::boolean, true);
  v_message_on   := coalesce((v_cfg #>> '{message,enabled}')::boolean, true);

  if p_attendance_status = 'attending' then
    if v_transport_on then
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
      v_has_transport := p_has_transportation;
    end if;

    if v_coming_on then
      v_coming_from := nullif(regexp_replace(btrim(coalesce(p_coming_from, '')), '\s+', ' ', 'g'), '');
      if (v_coming_req and v_coming_from is null) or char_length(coalesce(v_coming_from, '')) > 120 then
        raise exception 'RSVP_INVALID: coming_from' using errcode = '22023';
      end if;
    end if;

    if v_food_on then
      select coalesce(array_agg(distinct f order by f), '{}') into v_food from unnest(coalesce(p_food_preferences, '{}')) as f;
      if cardinality(v_food) > 4 or not (v_food <@ array['vegetable', 'pasta', 'fish', 'pork', 'beef', 'chicken']::text[]) then
        raise exception 'RSVP_INVALID: food_preferences' using errcode = '22023';
      end if;
    end if;

    if v_dietary_on then
      if p_has_food_restrictions is null then
        raise exception 'RSVP_INVALID: has_food_restrictions' using errcode = '22023';
      end if;
      v_has_restrictions := p_has_food_restrictions;
      if p_has_food_restrictions then
        v_restrictions := nullif(btrim(coalesce(p_food_restrictions, '')), '');
        if v_restrictions is null or char_length(v_restrictions) > 120 then
          raise exception 'RSVP_INVALID: food_restrictions' using errcode = '22023';
        end if;
      end if;
    end if;

    if v_access_on then
      v_access := nullif(btrim(coalesce(p_accessibility_needs, '')), '');
      if v_access is not null and char_length(v_access) > 255 then
        raise exception 'RSVP_INVALID: accessibility_needs' using errcode = '22023';
      end if;
    end if;

    if v_message_on then
      v_message := nullif(btrim(coalesce(p_message_to_couple, '')), '');
      if v_message is not null and char_length(v_message) > 500 then
        raise exception 'RSVP_INVALID: message_to_couple' using errcode = '22023';
      end if;
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

  v_custom := public.validate_custom_answers(p_attendance_status, p_custom_answers);

  insert into public.rsvp_responses as r (
    invitation_id, attendance_status, has_transportation, needs_transportation,
    vehicle_type, coming_from, food_preferences, has_food_restrictions,
    food_restrictions, accessibility_needs, bringing_additional_guest,
    message_to_couple, mobile_number, custom_answers, submitted_at, updated_at
  ) values (
    v_invitation.id, p_attendance_status,
    case when p_attendance_status = 'attending' then v_has_transport end,
    case when p_attendance_status = 'attending' and v_has_transport = false then p_needs_transportation end,
    case when p_attendance_status = 'attending' and v_has_transport then p_vehicle_type end,
    case when p_attendance_status = 'attending' then v_coming_from end,
    case when p_attendance_status = 'attending' then v_food else '{}'::text[] end,
    case when p_attendance_status = 'attending' then v_has_restrictions end,
    case when p_attendance_status = 'attending' and v_has_restrictions then v_restrictions end,
    case when p_attendance_status = 'attending' then v_access end,
    p_attendance_status = 'attending' and cardinality(v_guests) > 0,
    case when p_attendance_status = 'attending' then v_message end,
    v_mobile,
    v_custom,
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
    mobile_number = excluded.mobile_number,
    custom_answers = excluded.custom_answers
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


revoke execute on function public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text, jsonb) from public;
grant execute on function public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text, jsonb) to anon, authenticated;
