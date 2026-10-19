-- =============================================================================
--  MIGRATION 008 — Seating plan & Find My Seat
--  * seating_tables: named tables (shape, seats, position on the floor plan)
--  * invitations.table_id replaces the free-text table_number (migrated)
--  * seating_items: stage, dance floor, entrance… (inside/outside the hall)
--  * seat_assignments: one person per chair; freed automatically when guests
--    are removed or decline (seating_notices tells the admin what changed)
--  * get_invitation_table(): a guest's table, only after they RSVP "attending"
--  * find_my_seat(): public, read-only seat finder (own seat + own party only)
--  Run AFTER 007. Safe to re-run.
-- =============================================================================

-- ---------------------------------------------------------------- tables
create table if not exists public.seating_tables (
  id          uuid primary key default gen_random_uuid(),
  name        varchar(60) not null,
  shape       text not null default 'round',
  capacity    integer not null default 10,
  seat_sides  text not null default 'both',
  x           numeric not null default 0,
  y           numeric not null default 0,
  width       numeric not null default 170,
  height      numeric not null default 170,
  rotation    numeric not null default 0,
  placed      boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint seating_tables_name_required check (char_length(btrim(name)) >= 1),
  constraint seating_tables_shape_valid check (shape in ('round', 'rect')),
  constraint seating_tables_capacity_valid check (capacity between 1 and 40),
  constraint seating_tables_sides_valid check (seat_sides in ('both', 'one', 'all')),
  constraint seating_tables_size_valid check (width between 40 and 2000 and height between 40 and 2000)
);
create unique index if not exists seating_tables_name_uq on public.seating_tables (lower(btrim(name)));
drop trigger if exists seating_tables_updated_at on public.seating_tables;
create trigger seating_tables_updated_at before update on public.seating_tables for each row execute function public.set_updated_at();

create or replace function public.enforce_table_limit()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.seating_tables) >= 150 then
    raise exception 'TABLE_LIMIT_REACHED' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists seating_tables_limit on public.seating_tables;
create trigger seating_tables_limit before insert on public.seating_tables for each row execute function public.enforce_table_limit();

alter table public.invitations add column if not exists table_id uuid references public.seating_tables(id) on delete set null;
create index if not exists invitations_table_id_idx on public.invitations (table_id);

-- Migrate the old free-text tables ("5" → "Table 5") once.
do $$
declare r record; v_id uuid; v_name text;
begin
  for r in select distinct btrim(table_number) t from public.invitations
           where table_id is null and nullif(btrim(coalesce(table_number, '')), '') is not null loop
    v_name := case when r.t ~ '^\d+$' then 'Table ' || r.t else r.t end;
    select id into v_id from public.seating_tables where lower(btrim(name)) = lower(v_name);
    if v_id is null then
      insert into public.seating_tables (name, sort_order)
      values (left(v_name, 60), coalesce((select max(sort_order) from public.seating_tables), 0) + 1)
      returning id into v_id;
    end if;
    update public.invitations set table_id = v_id where table_id is null and btrim(table_number) = r.t;
  end loop;
  update public.invitations set table_number = null where table_id is not null and table_number is not null;
end $$;

-- ---------------------------------------------------------------- non-seat items
create table if not exists public.seating_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null,
  label       varchar(60) not null default '',
  x           numeric not null default 0,
  y           numeric not null default 0,
  width       numeric not null default 200,
  height      numeric not null default 90,
  rotation    numeric not null default 0,
  location    text not null default 'auto',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint seating_items_kind_valid check (kind in ('stage', 'dance_floor', 'entrance', 'buffet', 'cake', 'photo_booth',
    'sweetheart', 'bar', 'dj', 'gifts', 'registration', 'custom')),
  constraint seating_items_location_valid check (location in ('auto', 'inside', 'outside')),
  constraint seating_items_size_valid check (width between 20 and 3000 and height between 20 and 3000)
);
drop trigger if exists seating_items_updated_at on public.seating_items;
create trigger seating_items_updated_at before update on public.seating_items for each row execute function public.set_updated_at();

-- Room outline, canvas and Find My Seat visibility.
alter table public.wedding_settings add column if not exists seating_config jsonb not null
  default '{"room":{"x":100,"y":100,"width":1400,"height":900},"canvas":{"width":1600,"height":1100},"finder":{"mode":"hidden","from":null}}'::jsonb;
alter table public.wedding_settings drop constraint if exists wedding_settings_seating_config_is_object;
alter table public.wedding_settings add constraint wedding_settings_seating_config_is_object
  check (jsonb_typeof(seating_config) = 'object' and pg_column_size(seating_config) < 4000);

-- ---------------------------------------------------------------- chairs
create table if not exists public.seat_assignments (
  id             uuid primary key default gen_random_uuid(),
  table_id       uuid not null references public.seating_tables(id) on delete cascade,
  seat_index     integer not null,
  invitation_id  uuid not null references public.invitations(id) on delete cascade,
  guest_id       uuid references public.additional_guests(id) on delete cascade,
  created_at     timestamptz not null default now(),
  constraint seat_assignments_index_valid check (seat_index >= 0),
  constraint seat_assignments_chair_uq unique (table_id, seat_index)
);
create unique index if not exists seat_assignments_person_uq
  on public.seat_assignments (invitation_id, coalesce(guest_id, '00000000-0000-0000-0000-000000000000'::uuid));

create or replace function public.check_seat_assignment()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.seat_index >= (select capacity from public.seating_tables where id = new.table_id) then
    raise exception 'SEAT_OUT_OF_RANGE' using errcode = '22023';
  end if;
  if new.guest_id is not null and not exists (
    select 1 from public.additional_guests g where g.id = new.guest_id and g.invitation_id = new.invitation_id) then
    raise exception 'GUEST_NOT_IN_INVITATION' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists seat_assignments_check on public.seat_assignments;
create trigger seat_assignments_check before insert or update on public.seat_assignments
  for each row execute function public.check_seat_assignment();

-- Seating the invitee also sets their invitation's table.
create or replace function public.sync_invitation_table()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.guest_id is null then
    update public.invitations set table_id = new.table_id where id = new.invitation_id and table_id is distinct from new.table_id;
  end if;
  return new;
end;
$$;
drop trigger if exists seat_assignments_sync_table on public.seat_assignments;
create trigger seat_assignments_sync_table after insert or update on public.seat_assignments
  for each row execute function public.sync_invitation_table();

-- Fewer seats → chairs beyond the new capacity are emptied.
create or replace function public.trim_table_seats()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.capacity < old.capacity then
    delete from public.seat_assignments where table_id = new.id and seat_index >= new.capacity;
  end if;
  return new;
end;
$$;
drop trigger if exists seating_tables_trim on public.seating_tables;
create trigger seating_tables_trim after update of capacity on public.seating_tables
  for each row execute function public.trim_table_seats();

-- ---------------------------------------------------------------- notices
create table if not exists public.seating_notices (
  id           uuid primary key default gen_random_uuid(),
  person_name  text not null,
  table_name   text not null,
  reason       text not null,
  created_at   timestamptz not null default now()
);

create or replace function public.note_freed_seats(p_invitation_id uuid, p_guest_id uuid, p_all boolean, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.seating_notices (person_name, table_name, reason)
  select coalesce(g.guest_name, i.invitee_name), t.name, p_reason
  from public.seat_assignments s
  join public.invitations i on i.id = s.invitation_id
  join public.seating_tables t on t.id = s.table_id
  left join public.additional_guests g on g.id = s.guest_id
  where s.invitation_id = p_invitation_id
    and (p_all or s.guest_id is not distinct from p_guest_id);
  -- keep the list short
  delete from public.seating_notices where id in (select id from public.seating_notices order by created_at desc offset 200);
end;
$$;

create or replace function public.seating_on_invitation_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform public.note_freed_seats(old.id, null, true, 'invitation_deleted');
  delete from public.seat_assignments where invitation_id = old.id;
  return old;
end;
$$;
drop trigger if exists invitations_seating_cleanup on public.invitations;
create trigger invitations_seating_cleanup before delete on public.invitations
  for each row execute function public.seating_on_invitation_delete();

create or replace function public.seating_on_guest_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.note_freed_seats(old.invitation_id, old.id, false, 'guest_removed');
    return old;
  end if;
  if new.status = 'declined' and old.status <> 'declined' then
    perform public.note_freed_seats(new.invitation_id, new.id, false, 'guest_declined');
    delete from public.seat_assignments where guest_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists additional_guests_seating_cleanup on public.additional_guests;
create trigger additional_guests_seating_cleanup before delete or update of status on public.additional_guests
  for each row execute function public.seating_on_guest_change();

create or replace function public.seating_on_rsvp_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.note_freed_seats(old.invitation_id, null, true, 'rsvp_removed');
    delete from public.seat_assignments where invitation_id = old.invitation_id;
    return old;
  end if;
  if new.attendance_status = 'declining' and (tg_op = 'INSERT' or old.attendance_status is distinct from 'declining') then
    perform public.note_freed_seats(new.invitation_id, null, true, 'declined');
    delete from public.seat_assignments where invitation_id = new.invitation_id;
  end if;
  return new;
end;
$$;
drop trigger if exists rsvp_responses_seating_cleanup on public.rsvp_responses;
create trigger rsvp_responses_seating_cleanup after insert or update of attendance_status or delete on public.rsvp_responses
  for each row execute function public.seating_on_rsvp_change();

-- ---------------------------------------------------------------- security
alter table public.seating_tables enable row level security;
alter table public.seating_items enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.seating_notices enable row level security;

do $$
declare t text;
begin
  foreach t in array array['seating_tables', 'seating_items', 'seat_assignments', 'seating_notices'] loop
    execute format('drop policy if exists "Admins manage %1$s" on public.%1$I', t);
    execute format('create policy "Admins manage %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- guest-facing functions
create or replace function public.table_label_for(p_invitation_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select t.name::text from public.seat_assignments s join public.seating_tables t on t.id = s.table_id
      where s.invitation_id = p_invitation_id and s.guest_id is null),
    (select t.name::text from public.invitations i join public.seating_tables t on t.id = i.table_id where i.id = p_invitation_id),
    (select case when btrim(i.table_number) ~ '^\d+$' then 'Table ' || btrim(i.table_number) else nullif(btrim(i.table_number), '') end
       from public.invitations i where i.id = p_invitation_id)
  );
$$;

-- The guest's table — only once they have RSVP'd "attending".
create or replace function public.get_invitation_table(p_invitation_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select public.table_label_for(p_invitation_id)
  where exists (select 1 from public.rsvp_responses r where r.invitation_id = p_invitation_id and r.attendance_status = 'attending');
$$;

-- Public search results no longer reveal the table before the guest responds.
create or replace function public.find_invitation(search_name text)
returns table(invitation_id uuid, invitee_name text, table_number text, max_additional_guests integer, has_existing_response boolean, included_guests text[])
language sql stable security definer set search_path = ''
as $$
  select i.id, i.invitee_name, null::text, i.max_additional_guests,
    exists (select 1 from public.rsvp_responses r where r.invitation_id = i.id),
    coalesce((select array_agg(g.guest_name::text order by g.created_at, g.guest_name)
              from public.additional_guests g where g.invitation_id = i.id and g.added_by = 'admin'), '{}')
  from public.invitations i
  where i.is_active
    and char_length(public.normalize_name(find_invitation.search_name)) > 0
    and i.search_name = public.normalize_name(find_invitation.search_name)
  limit 1;
$$;

create or replace function public.find_invitation_by_code(invite_code text)
returns table(invitation_id uuid, invitee_name text, table_number text, max_additional_guests integer, has_existing_response boolean, included_guests text[])
language sql stable security definer set search_path = ''
as $$
  select i.id, i.invitee_name, null::text, i.max_additional_guests,
    exists (select 1 from public.rsvp_responses r where r.invitation_id = i.id),
    coalesce((select array_agg(g.guest_name::text order by g.created_at, g.guest_name)
              from public.additional_guests g where g.invitation_id = i.id and g.added_by = 'admin'), '{}')
  from public.invitations i
  where i.is_active and i.invitation_code = btrim(coalesce(find_invitation_by_code.invite_code, ''))
  limit 1;
$$;

-- Find My Seat. Returns the floor plan (no guest names) plus the searched
-- person's own table/chair and the names of their own party at that table.
create or replace function public.find_my_seat(search_name text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_cfg jsonb;
  v_mode text;
  v_from timestamptz;
  v_norm text := public.normalize_name(search_name);
  v_inv public.invitations%rowtype;
  v_guest_id uuid;
  v_inv_id uuid;
  v_person text;
  v_status text;
  v_table uuid;
  v_seat integer;
  v_layout jsonb;
  v_party jsonb;
begin
  select seating_config into v_cfg from public.wedding_settings limit 1;
  v_mode := coalesce(v_cfg #>> '{finder,mode}', 'hidden');
  v_from := nullif(v_cfg #>> '{finder,from}', '')::timestamptz;
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
  if v_status is null then
    return jsonb_build_object('status', 'pending', 'name', v_person);
  elsif v_status = 'declining' then
    return jsonb_build_object('status', 'declined', 'name', v_person);
  end if;

  select s.table_id, s.seat_index into v_table, v_seat
  from public.seat_assignments s where s.invitation_id = v_inv.id and s.guest_id is not distinct from v_guest_id;
  if v_table is null then
    v_table := v_inv.table_id;
  end if;
  if v_table is null or not exists (select 1 from public.seating_tables t where t.id = v_table and t.placed) then
    return jsonb_build_object('status', 'unseated', 'name', v_person,
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
    'seat', v_seat, 'party', v_party, 'layout', v_layout);
end;
$$;

revoke execute on function public.enforce_table_limit() from public, anon, authenticated;
revoke execute on function public.check_seat_assignment() from public, anon, authenticated;
revoke execute on function public.sync_invitation_table() from public, anon, authenticated;
revoke execute on function public.trim_table_seats() from public, anon, authenticated;
revoke execute on function public.note_freed_seats(uuid, uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.seating_on_invitation_delete() from public, anon, authenticated;
revoke execute on function public.seating_on_guest_change() from public, anon, authenticated;
revoke execute on function public.seating_on_rsvp_change() from public, anon, authenticated;
revoke execute on function public.table_label_for(uuid) from public, anon, authenticated;
revoke execute on function public.get_invitation_table(uuid) from public;
revoke execute on function public.find_my_seat(text) from public;
grant execute on function public.get_invitation_table(uuid) to anon, authenticated;
grant execute on function public.find_my_seat(text) to anon, authenticated;
grant execute on function public.find_invitation(text) to anon, authenticated;
grant execute on function public.find_invitation_by_code(text) to anon, authenticated;
