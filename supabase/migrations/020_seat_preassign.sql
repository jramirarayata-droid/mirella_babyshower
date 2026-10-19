-- 020: pre-assigned seats (Admin → Seating → "Pre-assign seats before guests RSVP").
-- The switch lives in wedding_settings.seating_config -> finder -> preassign (default off).
-- Off: everything works exactly as before (only "attending" guests see a seat; declining frees it).
-- On:  guests see a seat set for them even before they RSVP, with their answer ('rsvp') so it can
--      be coloured; declining keeps the seat (shown red) until the couple frees it.

create or replace function public.seat_preassign_on()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select (seating_config #>> '{finder,preassign}')::boolean from public.wedding_settings limit 1), false);
$$;
revoke execute on function public.seat_preassign_on() from public, anon, authenticated;

-- ---------------------------------------------------------------- Find My Seat
create or replace function public.find_my_seat(search_name text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cfg jsonb;
  v_mode text;
  v_from timestamptz;
  v_pre boolean;
  v_norm text := public.normalize_name(search_name);
  v_inv public.invitations%rowtype;
  v_guest_id uuid;
  v_inv_id uuid;
  v_person text;
  v_status text;
  v_rsvp text;
  v_table uuid;
  v_seat integer;
  v_layout jsonb;
  v_party jsonb;
begin
  select seating_config into v_cfg from public.wedding_settings limit 1;
  v_mode := coalesce(v_cfg #>> '{finder,mode}', 'hidden');
  v_from := nullif(v_cfg #>> '{finder,from}', '')::timestamptz;
  v_pre := coalesce((v_cfg #>> '{finder,preassign}')::boolean, false);
  if v_mode = 'hidden' or (v_mode = 'scheduled' and (v_from is null or now() < v_from)) then
    return jsonb_build_object('status', 'hidden');
  end if;
  if char_length(coalesce(v_norm, '')) = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;

  select * into v_inv from public.invitations i where i.is_active and i.search_name = v_norm limit 1;
  if found then
    v_person := v_inv.invitee_name;
  else
    select g.id, g.guest_name, g.invitation_id into v_guest_id, v_person, v_inv_id
    from public.additional_guests g join public.invitations i on i.id = g.invitation_id
    where i.is_active and public.normalize_name(g.guest_name) = v_norm and (g.added_by = 'admin' or g.status = 'approved')
    limit 1;
    if v_person is null then
      return jsonb_build_object('status', 'not_found');
    end if;
    select * into v_inv from public.invitations where id = v_inv_id;
  end if;

  select r.attendance_status into v_status from public.rsvp_responses r where r.invitation_id = v_inv.id;
  v_rsvp := coalesce(v_status, 'pending');

  select s.table_id, s.seat_index into v_table, v_seat
  from public.seat_assignments s where s.invitation_id = v_inv.id and s.guest_id is not distinct from v_guest_id;

  -- Without a pre-assigned chair (or with the switch off), the original rules apply.
  if not (v_pre and v_table is not null) then
    if v_status is null then
      return jsonb_build_object('status', 'pending', 'name', v_person);
    elsif v_status = 'declining' then
      return jsonb_build_object('status', 'declined', 'name', v_person);
    end if;
  end if;

  if v_table is null then
    v_table := v_inv.table_id;
  end if;
  if v_table is null or not exists (select 1 from public.seating_tables t where t.id = v_table and t.placed) then
    return jsonb_build_object('status', 'unseated', 'name', v_person, 'rsvp', v_rsvp,
      'tableName', (select name from public.seating_tables where id = v_table));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('seat', s.seat_index, 'name', coalesce(g.guest_name, v_inv.invitee_name))
                            order by s.seat_index), '[]'::jsonb)
  into v_party
  from public.seat_assignments s left join public.additional_guests g on g.id = s.guest_id
  where s.invitation_id = v_inv.id and s.table_id = v_table
    and s.guest_id is distinct from v_guest_id;

  v_layout := jsonb_build_object(
    'room', v_cfg -> 'room',
    'canvas', v_cfg -> 'canvas',
    'tables', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'shape', t.shape, 'capacity', t.capacity,
                 'seatSides', t.seat_sides, 'x', t.x, 'y', t.y, 'width', t.width, 'height', t.height, 'rotation', t.rotation))
               from public.seating_tables t where t.placed), '[]'::jsonb),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', it.id, 'kind', it.kind, 'label', it.label, 'x', it.x, 'y', it.y,
                 'width', it.width, 'height', it.height, 'rotation', it.rotation, 'location', it.location))
               from public.seating_items it), '[]'::jsonb));

  return jsonb_build_object('status', 'seated', 'name', v_person, 'tableId', v_table,
    'tableName', (select name from public.seating_tables where id = v_table),
    'seat', v_seat, 'party', v_party, 'layout', v_layout,
    -- Only sent when seats are pre-assigned, so the page knows to colour them.
    'rsvp', case when v_pre then v_rsvp end);
end;
$$;
revoke execute on function public.find_my_seat(text) from public;
grant execute on function public.find_my_seat(text) to anon, authenticated;

-- ---------------------------------------------------------------- RSVP confirmation
-- The guest's table and chair, right after they RSVP "attending" (chair only when pre-assign is on).
create or replace function public.get_invitation_seat(p_invitation_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'tableName', public.table_label_for(p_invitation_id),
    'seat', case when public.seat_preassign_on() then
              (select s.seat_index from public.seat_assignments s where s.invitation_id = p_invitation_id and s.guest_id is null) end,
    'preassign', public.seat_preassign_on())
  where exists (select 1 from public.rsvp_responses r where r.invitation_id = p_invitation_id and r.attendance_status = 'attending');
$$;
revoke execute on function public.get_invitation_seat(uuid) from public;
grant execute on function public.get_invitation_seat(uuid) to anon, authenticated;

-- ---------------------------------------------------------------- declines
create or replace function public.seating_on_rsvp_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_pre boolean := public.seat_preassign_on();
begin
  if tg_op = 'DELETE' then
    -- Pre-assign on: the RSVP is gone but the seat the couple set stays (the guest is "waiting" again).
    if not v_pre then
      perform public.note_freed_seats(old.invitation_id, null, true, 'rsvp_removed');
      delete from public.seat_assignments where invitation_id = old.invitation_id;
    end if;
    return old;
  end if;
  if new.attendance_status = 'declining' and (tg_op = 'INSERT' or old.attendance_status is distinct from 'declining') then
    if v_pre then
      -- Keep the seat (shown red) and let the couple know; they free it from Seating.
      perform public.note_freed_seats(new.invitation_id, null, true, 'declined_held');
    else
      perform public.note_freed_seats(new.invitation_id, null, true, 'declined');
      delete from public.seat_assignments where invitation_id = new.invitation_id;
    end if;
  end if;
  return new;
end;
$$;

-- Turning pre-assign off goes back to the original rules: seats held by guests who declined are freed.
create or replace function public.seating_on_preassign_off()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  r record;
begin
  if coalesce((old.seating_config #>> '{finder,preassign}')::boolean, false)
     and not coalesce((new.seating_config #>> '{finder,preassign}')::boolean, false) then
    for r in
      select distinct s.invitation_id from public.seat_assignments s
      join public.rsvp_responses x on x.invitation_id = s.invitation_id and x.attendance_status = 'declining'
    loop
      perform public.note_freed_seats(r.invitation_id, null, true, 'declined');
      delete from public.seat_assignments where invitation_id = r.invitation_id;
    end loop;
  end if;
  return new;
end;
$$;
drop trigger if exists wedding_settings_preassign_off on public.wedding_settings;
create trigger wedding_settings_preassign_off after update of seating_config on public.wedding_settings
  for each row execute function public.seating_on_preassign_off();
