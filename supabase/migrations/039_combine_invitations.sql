-- 039: Include one invitation in another (e.g. Arielito Pugay joins Violeta
-- Pugay's invitation as an included guest), and give an included guest their
-- own invitation again.
--
-- Combining keeps everything that was linked to the person:
--   * their chair in Seating (same table, same chair)
--   * their place in the entourage
--   * their guest photos
--   * their own included guests (they come along, as included guests)
--   * their "attending" RSVP answer, when the other invitation has none yet
--     (a "can't come" answer is not carried over — it would decline the
--     whole combined invitation; it is kept on the guest instead)
--   * their old invitation link / QR code: it now opens the combined invitation
-- What it was (name, link code, side, position, addressed as, allowed guests,
-- printed date, table) is kept on the guest, so "own invitation again" can put
-- it back with the same link.
--
-- Nothing changes until an admin uses it. Safe to run more than once.

alter table public.additional_guests
  add column if not exists merged_from jsonb;

comment on column public.additional_guests.merged_from is
  'Set when this guest used to have their own invitation (combined into this one): the old invitation''s details, so it can be restored.';

create index if not exists additional_guests_merged_code_idx
  on public.additional_guests ((merged_from ->> 'invitation_code'))
  where merged_from is not null;

-- ---------------------------------------------------------------------------
-- Include invitation p_from in invitation p_into. Returns the guest id the
-- invitee of p_from now has on p_into.
create or replace function public.admin_include_invitation(p_from uuid, p_into uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_from public.invitations%rowtype;
  v_into public.invitations%rowtype;
  v_from_rsvp public.rsvp_responses%rowtype;
  v_has_into_rsvp boolean;
  v_main uuid;
  v_target uuid;
  v_g record;
  v_map jsonb := '{}'::jsonb;   -- old guest id ('' = the invitee) -> guest id on p_into
  v_moved text[] := '{}';
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if p_from is null or p_into is null or p_from = p_into then
    raise exception 'COMBINE_SAME_INVITATION' using errcode = '22023';
  end if;

  -- Lock both, always in the same order.
  perform 1 from public.invitations where id in (p_from, p_into) order by id for update;
  select * into v_from from public.invitations where id = p_from;
  if not found then raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into v_into from public.invitations where id = p_into;
  if not found then raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002'; end if;
  if public.normalize_name(v_from.invitee_name) = public.normalize_name(v_into.invitee_name) then
    raise exception 'COMBINE_SAME_NAME' using errcode = '22023';
  end if;
  if 1 + (select count(*) from public.additional_guests g
           where (g.invitation_id = p_into and g.added_by = 'admin')
              or (g.invitation_id = p_from and g.status <> 'declined')) > 20 then
    raise exception 'TOO_MANY_INCLUDED_GUESTS' using errcode = '22023';
  end if;

  select * into v_from_rsvp from public.rsvp_responses where invitation_id = p_from;
  v_has_into_rsvp := exists (select 1 from public.rsvp_responses where invitation_id = p_into);

  -- 1. The invitee becomes an included guest (re-using a guest of the same name if already there).
  select g.id into v_main from public.additional_guests g
  where g.invitation_id = p_into and public.normalize_name(g.guest_name) = public.normalize_name(v_from.invitee_name);
  if v_main is null then
    insert into public.additional_guests (invitation_id, rsvp_response_id, guest_name, status, added_by)
    values (p_into, null, v_from.invitee_name, 'approved', 'admin')
    returning id into v_main;
  else
    update public.additional_guests set added_by = 'admin', status = 'approved', rsvp_response_id = null where id = v_main;
  end if;
  update public.additional_guests set merged_from = jsonb_build_object(
      'invitee_name', v_from.invitee_name,
      'invitation_code', v_from.invitation_code,
      'side', v_from.side,
      'position_mode', v_from.position_mode,
      'position_label', v_from.position_label,
      'addressed_as', v_from.addressed_as,
      'max_additional_guests', v_from.max_additional_guests,
      'printed_at', v_from.printed_at,
      'table_id', v_from.table_id,
      'is_active', v_from.is_active,
      'created_at', v_from.created_at,
      'rsvp', case when v_from_rsvp.id is not null then to_jsonb(v_from_rsvp) end,
      'combined_at', now())
  where id = v_main;
  v_map := v_map || jsonb_build_object('', v_main);
  v_moved := array_append(v_moved, v_from.invitee_name);

  -- 2. Their own guests come along as included guests (declined requests are dropped).
  for v_g in
    select * from public.additional_guests where invitation_id = p_from order by created_at
  loop
    if v_g.status = 'declined' then
      continue;   -- deleted with the old invitation below
    end if;
    select g.id into v_target from public.additional_guests g
    where g.invitation_id = p_into and public.normalize_name(g.guest_name) = public.normalize_name(v_g.guest_name);
    if v_target is null and public.normalize_name(v_g.guest_name) <> public.normalize_name(v_into.invitee_name) then
      update public.additional_guests
      set invitation_id = p_into, added_by = 'admin', status = 'approved', rsvp_response_id = null
      where id = v_g.id;
      v_target := v_g.id;
    end if;
    if v_target is not null then
      v_map := v_map || jsonb_build_object(v_g.id::text, v_target);
      v_moved := array_append(v_moved, v_g.guest_name);
    end if;
    v_target := null;
  end loop;

  -- 3. Chairs: each person keeps theirs, unless they already had one on p_into.
  for v_g in select * from public.seat_assignments where invitation_id = p_from loop
    v_target := nullif(v_map ->> coalesce(v_g.guest_id::text, ''), '')::uuid;
    if v_target is not null and not exists (
        select 1 from public.seat_assignments s where s.invitation_id = p_into and s.guest_id = v_target and s.id <> v_g.id) then
      update public.seat_assignments set invitation_id = p_into, guest_id = v_target where id = v_g.id;
    else
      if v_target is not null then
        insert into public.seating_notices (person_name, table_name, reason)
        select coalesce(g.guest_name, v_from.invitee_name), t.name, 'combined_duplicate'
        from public.seating_tables t left join public.additional_guests g on g.id = v_g.guest_id
        where t.id = v_g.table_id;
      end if;
      delete from public.seat_assignments where id = v_g.id;
    end if;
    v_target := null;
  end loop;

  -- 4. Entourage places, guest photos.
  update public.entourage_links l
  set invitation_id = p_into, guest_id = nullif(v_map ->> coalesce(l.guest_id::text, ''), '')::uuid
  where l.invitation_id = p_from and v_map ? coalesce(l.guest_id::text, '');
  delete from public.entourage_links where invitation_id = p_from;

  update public.guest_photo_sessions s
  set invitation_id = p_into, guest_id = nullif(v_map ->> coalesce(s.guest_id::text, ''), '')::uuid
  where s.invitation_id = p_from;
  update public.guest_photos ph
  set invitation_id = p_into, guest_id = nullif(v_map ->> coalesce(ph.guest_id::text, ''), '')::uuid
  where ph.invitation_id = p_from;

  -- 5. Opened link history adds up on the combined invitation.
  if exists (select 1 from public.invitation_opens where invitation_id = p_from) then
    insert into public.invitation_opens as o (invitation_id, first_opened_at, last_opened_at, open_count)
    select p_into, f.first_opened_at, f.last_opened_at, f.open_count from public.invitation_opens f where f.invitation_id = p_from
    on conflict (invitation_id) do update set
      first_opened_at = least(o.first_opened_at, excluded.first_opened_at),
      last_opened_at = greatest(o.last_opened_at, excluded.last_opened_at),
      open_count = o.open_count + excluded.open_count;
  end if;

  -- 6. RSVP: if only the old invitation was answered "attending", the answer moves over.
  if v_from_rsvp.id is not null and v_from_rsvp.attendance_status = 'attending' and not v_has_into_rsvp then
    update public.rsvp_responses set invitation_id = p_into where id = v_from_rsvp.id;
  end if;

  -- 7. The old invitation goes (anything still on it — e.g. a second answer — goes with it).
  delete from public.invitations where id = p_from;

  insert into public.admin_activity_logs (admin_user_id, action, target_table, target_id, details)
  values (auth.uid(), 'invitations_combined', 'invitations', p_into, jsonb_build_object(
    'from', v_from.invitee_name, 'into', v_into.invitee_name, 'people', to_jsonb(v_moved),
    'old_code', v_from.invitation_code,
    'answer', case when v_from_rsvp.id is null then 'none'
                  when v_has_into_rsvp or v_from_rsvp.attendance_status <> 'attending' then 'kept_on_guest'
                  else 'moved' end));

  return v_main;
end;
$$;

revoke all on function public.admin_include_invitation(uuid, uuid) from public, anon;
grant execute on function public.admin_include_invitation(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Give an included guest their own invitation again. Returns the new invitation id.
-- If they were combined from an invitation, its details and link come back.
create or replace function public.admin_separate_guest(p_guest uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_g public.additional_guests%rowtype;
  v_from public.invitations%rowtype;
  v_s jsonb;
  v_code text;
  v_table uuid;
  v_new uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;
  select * into v_g from public.additional_guests where id = p_guest for update;
  if not found then raise exception 'GUEST_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into v_from from public.invitations where id = v_g.invitation_id for update;
  v_s := coalesce(v_g.merged_from, '{}'::jsonb);

  if exists (select 1 from public.invitations i where i.is_active and i.search_name = public.normalize_name(v_g.guest_name)) then
    raise exception 'SEPARATE_NAME_TAKEN' using errcode = '23505';
  end if;

  v_code := nullif(v_s ->> 'invitation_code', '');
  if v_code is not null and exists (select 1 from public.invitations where invitation_code = v_code) then
    v_code := null;
  end if;
  v_table := nullif(v_s ->> 'table_id', '')::uuid;
  if v_table is null or not exists (select 1 from public.seating_tables where id = v_table) then
    v_table := v_from.table_id;
  end if;

  insert into public.invitations (invitee_name, side, position_mode, position_label, addressed_as,
                                  max_additional_guests, printed_at, table_id, is_active, invitation_code)
  values (
    v_g.guest_name,
    coalesce(nullif(v_s ->> 'side', ''), v_from.side, 'groom'),
    coalesce(nullif(v_s ->> 'position_mode', ''), 'auto'),
    nullif(v_s ->> 'position_label', ''),
    nullif(v_s ->> 'addressed_as', ''),
    coalesce((v_s ->> 'max_additional_guests')::integer, 0),
    nullif(v_s ->> 'printed_at', '')::timestamptz,
    v_table,
    true,
    coalesce(v_code, substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)))
  returning id into v_new;

  -- Their chair, entourage place and photos go with them.
  update public.seat_assignments set invitation_id = v_new, guest_id = null where guest_id = p_guest;
  update public.entourage_links set invitation_id = v_new, guest_id = null where guest_id = p_guest;
  update public.guest_photo_sessions set invitation_id = v_new, guest_id = null where guest_id = p_guest;
  update public.guest_photos set invitation_id = v_new, guest_id = null where guest_id = p_guest;

  delete from public.additional_guests where id = p_guest;

  insert into public.admin_activity_logs (admin_user_id, action, target_table, target_id, details)
  values (auth.uid(), 'guest_separated', 'invitations', v_new, jsonb_build_object(
    'guest', v_g.guest_name, 'from', v_from.invitee_name, 'same_link', v_code is not null));

  return v_new;
end;
$$;

revoke all on function public.admin_separate_guest(uuid) from public, anon;
grant execute on function public.admin_separate_guest(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Old links keep working: a code from a combined invitation opens the invitation it joined.
create or replace function public.invitation_id_for_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (select i.id from public.invitations i where i.is_active and i.invitation_code = p_code limit 1),
    (select i.id from public.additional_guests g join public.invitations i on i.id = g.invitation_id
      where i.is_active and g.merged_from ->> 'invitation_code' = p_code
      order by g.created_at limit 1));
$$;

revoke all on function public.invitation_id_for_code(text) from public, anon, authenticated;

create or replace function public.find_invitation_by_code(invite_code text)
returns table(invitation_id uuid, invitee_name text, table_number text, max_additional_guests integer, has_existing_response boolean, included_guests text[])
language sql
stable
security definer
set search_path to ''
as $$
  select i.id, i.invitee_name, null::text, i.max_additional_guests,
    exists (select 1 from public.rsvp_responses r where r.invitation_id = i.id),
    coalesce((select array_agg(g.guest_name::text order by g.created_at, g.guest_name)
              from public.additional_guests g where g.invitation_id = i.id and g.added_by = 'admin'), '{}')
  from public.invitations i
  where i.id = public.invitation_id_for_code(btrim(coalesce(find_invitation_by_code.invite_code, '')))
  limit 1;
$$;

create or replace function public.open_invitation(invite_code text)
returns table(invitee_name text, included_guests text[], attendance_status text, position_mode text, position_label text, position_member_id text, addressed_as text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_code text := btrim(coalesce(open_invitation.invite_code, ''));
  v_id uuid;
begin
  if v_code = '' or length(v_code) > 64 then
    return;
  end if;

  v_id := public.invitation_id_for_code(v_code);

  if v_id is null then
    return;
  end if;

  if not public.is_admin() then
    insert into public.invitation_opens as o (invitation_id)
    values (v_id)
    on conflict (invitation_id) do update
      set last_opened_at = now(), open_count = o.open_count + 1;
  end if;

  return query
  select
    i.invitee_name::text,
    coalesce((select array_agg(g.guest_name::text order by g.created_at, g.guest_name)
              from public.additional_guests g
              where g.invitation_id = i.id and g.added_by = 'admin'), '{}'),
    (select r.attendance_status::text from public.rsvp_responses r where r.invitation_id = i.id limit 1),
    coalesce(i.position_mode, 'auto')::text,
    i.position_label::text,
    (select l.member_id::text from public.entourage_links l
      where l.invitation_id = i.id and l.guest_id is null
      order by l.created_at limit 1),
    i.addressed_as::text
  from public.invitations i
  where i.id = v_id;
end;
$$;
