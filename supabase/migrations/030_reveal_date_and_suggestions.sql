-- 030: One reveal date that features can follow, Polaroid style for guest
-- photos, and a gentle "Did you mean …?" for guests who mistype their name.
--
--  * admin_preferences 'schedule' = { revealAt }. Raffle, Find My Seat and
--    guest photos gain a third timing choice, mode = 'reveal': shown from the
--    reveal date (hidden while no date is set).
--  * public_display_prefs() also returns revealAt (for the website's menu).
--  * guest_photos_info() also returns the display style ('classic'|'polaroid').
--  * suggest_guest_name(): one close match for a mistyped name, or null.

create or replace function public.reveal_at()
returns timestamptz language sql stable security definer set search_path = ''
as $$
  select nullif((select value->>'revealAt' from public.admin_preferences where key = 'schedule'), '')::timestamptz;
$$;
revoke all on function public.reveal_at() from public, anon, authenticated;

-- Shown now? for a {mode, from} timing setting.
create or replace function public.timing_on(p_mode text, p_from text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case coalesce(p_mode, 'hidden')
    when 'visible' then true
    when 'scheduled' then coalesce(now() >= nullif(p_from, '')::timestamptz, false)
    when 'reveal' then coalesce(now() >= public.reveal_at(), false)
    else false end;
$$;
revoke all on function public.timing_on(text, text) from public, anon, authenticated;

create or replace function public.raffle_is_visible()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.timing_on(cfg->>'mode', cfg->>'from')
  from (select coalesce((select value from public.admin_preferences where key = 'raffle'), '{}'::jsonb) as cfg) c;
$$;
revoke all on function public.raffle_is_visible() from public, anon, authenticated;

create or replace function public.guest_photos_visible()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.timing_on(c->>'mode', c->>'from') from (select public.guest_photos_cfg() c) x;
$$;
revoke all on function public.guest_photos_visible() from public, anon, authenticated;

create or replace function public.seat_finder_open()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.timing_on(seating_config #>> '{finder,mode}', seating_config #>> '{finder,from}')
  from public.wedding_settings limit 1;
$$;
revoke all on function public.seat_finder_open() from public, anon, authenticated;

create or replace function public.find_my_seat(search_name text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cfg jsonb;
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
  v_pre := coalesce((v_cfg #>> '{finder,preassign}')::boolean, false);
  if not public.seat_finder_open() then
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

create or replace function public.guest_photos_cfg()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'mode', coalesce(c->>'mode', 'hidden'),
    'from', c->>'from',
    'until', c->>'until',
    'approval', coalesce(c->>'approval', 'instant'),
    'perGuest', least(200, greatest(1, coalesce((c->>'perGuest')::int, 25))),
    'total', least(5000, greatest(10, coalesce((c->>'total')::int, 1500))),
    'title', coalesce(nullif(c->>'title', ''), 'Shared by our guests'),
    'subtitle', coalesce(c->>'subtitle', 'Add the moments you captured — every photo is a gift.'),
    'style', case when c->>'style' = 'polaroid' then 'polaroid' else 'classic' end)
  from (select coalesce((select value from public.admin_preferences where key = 'guest_photos'), '{}'::jsonb) as c) x;
$$;
revoke all on function public.guest_photos_cfg() from public, anon, authenticated;

create or replace function public.guest_photos_info()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'visible', public.guest_photos_visible(),
    'open', public.guest_photos_open(),
    'approval', c->>'approval',
    'perGuest', (c->>'perGuest')::int,
    'title', c->>'title',
    'subtitle', c->>'subtitle',
    'style', c->>'style',
    'count', (select count(*) from public.guest_photos p where p.uploaded and p.status = 'visible'))
  from (select public.guest_photos_cfg() c) x;
$$;
grant execute on function public.guest_photos_info() to anon, authenticated;

create or replace function public.public_display_prefs()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select
      (select value from public.admin_preferences where key = 'printables') as printables,
      (select value from public.admin_preferences where key = 'virtual_invite') as vi,
      (select value from public.admin_preferences where key = 'website_privacy') as web,
      (select value from public.admin_preferences where key = 'share_preview') as share,
      (select value from public.admin_preferences where key = 'raffle') as raffle,
      (select value from public.admin_preferences where key = 'monogram') as mono
  ), arr as (
    select p.*,
      coalesce(p.vi->>'backMode', 'printables') = 'custom' as custom_back
    from p
  )
  select jsonb_build_object(
    'card', jsonb_build_object(
      'backIds', case
        when custom_back and jsonb_typeof(vi->'backIds') = 'array' then vi->'backIds'
        when not custom_back and jsonb_typeof(printables->'backIds') = 'array' then printables->'backIds'
        else 'null'::jsonb end,
      'boldIds', case
        when custom_back and jsonb_typeof(vi->'boldIds') = 'array' then vi->'boldIds'
        when not custom_back and jsonb_typeof(printables->'boldIds') = 'array' then printables->'boldIds'
        else '[]'::jsonb end,
      'hideVenues', coalesce((vi->>'hideVenues')::boolean, false),
      'hideInfo', coalesce((vi->>'hideInfo')::boolean, false),
      'hideLinks', coalesce((vi->>'hideLinks')::boolean, false)),
    'website', jsonb_build_object(
      'hideVenues', coalesce((web->>'hideVenues')::boolean, false),
      'hideInfo', coalesce((web->>'hideInfo')::boolean, false)),
    'sharePreviewUrl', share->>'url',
    'raffleVisible', public.raffle_is_visible(),
    'revealAt', public.reveal_at(),
    'monogram', case when coalesce((mono->>'enabled')::boolean, false) and coalesce(mono->>'url', '') ~* '^https://'
      then jsonb_build_object('url', mono->>'url', 'aspect', coalesce((mono->>'aspect')::numeric, 1))
      else null end)
  from arr;
$$;
grant execute on function public.public_display_prefs() to anon, authenticated;

-- Edit distance (names are short; the guest list is small).
create or replace function public.name_distance(a text, b text)
returns integer language plpgsql immutable set search_path = ''
as $$
declare
  la int := char_length(a);
  lb int := char_length(b);
  prev int[];
  cur int[];
  i int;
  j int;
begin
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  prev := array(select generate_series(0, lb));
  for i in 1..la loop
    cur := array[i];
    for j in 1..lb loop
      cur := cur || least(prev[j + 1] + 1, cur[j] + 1,
        prev[j] + case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end);
    end loop;
    prev := cur;
  end loop;
  return prev[lb + 1];
end;
$$;
revoke all on function public.name_distance(text, text) from public, anon, authenticated;

-- One close match for a mistyped name ("Rina Garica" → "Rina Garcia"),
-- only when exactly one guest is that close; otherwise null.
create or replace function public.suggest_guest_name(search_name text)
returns text language plpgsql stable security definer set search_path = ''
as $$
declare
  v_norm text := public.normalize_name(search_name);
  v_sorted text;
  v_max int;
  v_best text;
  v_best_d int := 99;
  v_ties int := 0;
  r record;
  d int;
begin
  if char_length(coalesce(v_norm, '')) < 4 then return null; end if;
  v_max := case when char_length(v_norm) < 8 then 1 else 2 end;
  v_sorted := array_to_string(array(select unnest(string_to_array(v_norm, ' ')) order by 1), ' ');
  for r in
    select i.invitee_name as name from public.invitations i where i.is_active
    union
    select g.guest_name from public.additional_guests g join public.invitations i on i.id = g.invitation_id
    where i.is_active and (g.added_by = 'admin' or g.status = 'approved')
  loop
    continue when r.name is null;
    d := public.name_distance(v_norm, public.normalize_name(r.name));
    if d > 0 and array_to_string(array(select unnest(string_to_array(public.normalize_name(r.name), ' ')) order by 1), ' ') = v_sorted then
      d := 1;
    end if;
    continue when d = 0 or d > v_max;
    if d < v_best_d then
      v_best_d := d; v_best := r.name; v_ties := 1;
    elsif d = v_best_d and r.name is distinct from v_best then
      v_ties := v_ties + 1;
    end if;
  end loop;
  return case when v_ties = 1 then v_best end;
end;
$$;
revoke all on function public.suggest_guest_name(text) from public;
grant execute on function public.suggest_guest_name(text) to anon, authenticated;
