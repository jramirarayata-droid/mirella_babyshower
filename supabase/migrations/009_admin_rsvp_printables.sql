-- =============================================================================
--  MIGRATION 009 — RSVP recorded by the couple + printed-invitation tracking
--  * rsvp_responses.recorded_by_admin: "Confirmed by couple" (e.g. elderly guests)
--  * admin_record_rsvp(): admin-only; records attending / not attending without
--    the online form's required answers. A later online RSVP replaces it.
--  * invitations.printed_at: when a paper invitation was last printed
--  Run AFTER 008. Safe to re-run.
-- =============================================================================

alter table public.rsvp_responses add column if not exists recorded_by_admin boolean not null default false;
alter table public.invitations add column if not exists printed_at timestamptz;

-- When the guest (not an admin) submits online, it is their own response again.
create or replace function public.rsvp_mark_source()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.recorded_by_admin := false;
  end if;
  return new;
end;
$$;
drop trigger if exists rsvp_responses_source on public.rsvp_responses;
create trigger rsvp_responses_source before insert or update on public.rsvp_responses
  for each row execute function public.rsvp_mark_source();

create or replace function public.admin_record_rsvp(p_invitation_id uuid, p_status text, p_mobile_number text default null)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_mobile text;
  v_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_status not in ('attending', 'declining') then
    raise exception 'RSVP_INVALID: attendance' using errcode = '22023';
  end if;
  if not exists (select 1 from public.invitations where id = p_invitation_id) then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_mobile := public.normalize_ph_mobile(p_mobile_number);
  if v_mobile is null and nullif(btrim(coalesce(p_mobile_number, '')), '') is not null then
    raise exception 'RSVP_INVALID: mobile_number' using errcode = '22023';
  end if;

  insert into public.rsvp_responses as r (
    invitation_id, attendance_status, has_transportation, needs_transportation, vehicle_type, coming_from,
    food_preferences, has_food_restrictions, food_restrictions, accessibility_needs, bringing_additional_guest,
    message_to_couple, mobile_number, custom_answers, recorded_by_admin, submitted_at, updated_at
  ) values (
    p_invitation_id, p_status, null, null, null, null, '{}', null, null, null, false, null, v_mobile, '{}'::jsonb, true, now(), now()
  )
  on conflict (invitation_id) do update set
    attendance_status = excluded.attendance_status,
    has_transportation = null, needs_transportation = null, vehicle_type = null, coming_from = null,
    food_preferences = '{}', has_food_restrictions = null, food_restrictions = null, accessibility_needs = null,
    bringing_additional_guest = false, message_to_couple = null,
    mobile_number = coalesce(excluded.mobile_number, r.mobile_number),
    custom_answers = '{}'::jsonb, recorded_by_admin = true
  returning r.id into v_id;

  -- Guest-requested plus-ones belong to an online RSVP; a couple-recorded response has none.
  delete from public.additional_guests where invitation_id = p_invitation_id and added_by = 'invitee';

  insert into public.admin_activity_logs (admin_user_id, action, target_table, target_id, details)
  values (auth.uid(), 'rsvp_recorded_by_admin', 'invitations', p_invitation_id, jsonb_build_object('status', p_status));
  return v_id;
end;
$$;

revoke execute on function public.rsvp_mark_source() from public, anon, authenticated;
revoke execute on function public.admin_record_rsvp(uuid, text, text) from public, anon;
grant execute on function public.admin_record_rsvp(uuid, text, text) to authenticated;
