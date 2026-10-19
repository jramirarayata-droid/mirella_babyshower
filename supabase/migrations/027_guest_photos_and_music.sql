-- 027: guest photo uploads and background music.
--
-- Guest photos: guests type their name (as on the invitation) on #/photos, then
-- add photos from their phone. Photos are shrunk on the phone first (about
-- 400 KB + a 35 KB thumbnail, location data removed). Uploads only go to
-- one-time slots handed out here, after checking the gallery is open and the
-- guest's and the gallery's limits — nobody can write to storage otherwise.
-- Settings: admin preference "guest_photos". Admin → Guest Photos.
--
-- Music: admin preference "music" (song file in wedding-assets/music/, the part
-- to play, fades, loop, volume, pages). public_music() gives guests what to play.

-- ------------------------------------------------------------------ storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('guest-photos', 'guest-photos', true, 4194304, array['image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Songs go in wedding-assets (up to 15 MB there anyway).
update storage.buckets
  set allowed_mime_types = (
    select array_agg(distinct m) from unnest(coalesce(allowed_mime_types, '{}') || array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg']) m)
  where id = 'wedding-assets';

-- ------------------------------------------------------------------ tables
create table if not exists public.guest_photo_sessions (
  token         text primary key check (length(token) >= 24),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  guest_id      uuid references public.additional_guests(id) on delete cascade,
  name          text not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null
);
alter table public.guest_photo_sessions enable row level security;
revoke all on public.guest_photo_sessions from anon, authenticated;

create table if not exists public.guest_photos (
  id              uuid primary key default gen_random_uuid(),
  invitation_id   uuid references public.invitations(id) on delete set null,
  guest_id        uuid references public.additional_guests(id) on delete set null,
  uploader_name   text not null,
  path            text not null unique,
  thumb_path      text not null unique,
  bytes           bigint,
  uploaded        boolean not null default false,
  slot_expires_at timestamptz not null,
  status          text not null default 'visible' check (status in ('visible', 'pending', 'hidden')),
  created_at      timestamptz not null default now()
);
create index if not exists guest_photos_list_idx on public.guest_photos (uploaded, status, created_at desc);
create index if not exists guest_photos_person_idx on public.guest_photos (invitation_id, guest_id);
alter table public.guest_photos enable row level security;
create policy "Admins read guest photos" on public.guest_photos for select to authenticated using (public.is_admin());
create policy "Admins update guest photos" on public.guest_photos for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins remove guest photos" on public.guest_photos for delete to authenticated using (public.is_admin());
revoke all on public.guest_photos from anon;
grant select, update, delete on public.guest_photos to authenticated;

-- ------------------------------------------------------------------ settings helpers (internal)
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
    'subtitle', coalesce(c->>'subtitle', 'Add the moments you captured — every photo is a gift.'))
  from (select coalesce((select value from public.admin_preferences where key = 'guest_photos'), '{}'::jsonb) as c) x;
$$;

-- The gallery shows on the website (Visible, or Visible from a date that has come).
create or replace function public.guest_photos_visible()
returns boolean language sql stable security definer set search_path = ''
as $$
  select case c->>'mode'
    when 'visible' then true
    when 'scheduled' then coalesce(now() >= (c->>'from')::timestamptz, false)
    else false end
  from (select public.guest_photos_cfg() c) x;
$$;

-- Guests can add photos: the gallery shows, and the "until" date (if any) hasn't passed.
create or replace function public.guest_photos_open()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.guest_photos_visible()
     and (c->>'until' is null or c->>'until' = '' or now() < (c->>'until')::timestamptz)
  from (select public.guest_photos_cfg() c) x;
$$;

revoke all on function public.guest_photos_cfg() from public, anon, authenticated;
revoke all on function public.guest_photos_visible() from public, anon, authenticated;
revoke all on function public.guest_photos_open() from public, anon, authenticated;

-- Storage: a guest may upload only into a slot handed out by guest_photo_reserve.
create or replace function public.guest_photo_slot_ok(p_name text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.guest_photos p
    where (p.path = p_name or p.thumb_path = p_name) and not p.uploaded and p.slot_expires_at > now());
$$;
grant execute on function public.guest_photo_slot_ok(text) to anon, authenticated;

create policy "Guests upload into their photo slots" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'guest-photos' and public.guest_photo_slot_ok(name));
create policy "Admins remove guest photo files" on storage.objects for delete to authenticated
  using (bucket_id = 'guest-photos' and public.is_admin());

-- ------------------------------------------------------------------ public: guests
-- What the photos page needs to know.
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
    'count', (select count(*) from public.guest_photos p where p.uploaded and p.status = 'visible'))
  from (select public.guest_photos_cfg() c) x;
$$;

-- "Who are you?" — the full name as on the invitation (or an included guest). Starts a session.
create or replace function public.guest_photo_start(p_name text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_norm text := public.normalize_name(p_name);
  v_inv uuid;
  v_guest uuid;
  v_person text;
  v_token text;
begin
  if not public.guest_photos_open() then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  if char_length(coalesce(v_norm, '')) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select i.id, i.invitee_name into v_inv, v_person from public.invitations i where i.is_active and i.search_name = v_norm limit 1;
  if v_inv is null then
    select g.invitation_id, g.id, g.guest_name into v_inv, v_guest, v_person
    from public.additional_guests g join public.invitations i on i.id = g.invitation_id
    where i.is_active and public.normalize_name(g.guest_name) = v_norm and (g.added_by = 'admin' or g.status = 'approved')
    limit 1;
  end if;
  if v_inv is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.guest_photo_sessions (token, invitation_id, guest_id, name, expires_at)
  values (v_token, v_inv, v_guest, btrim(v_person), now() + interval '90 days');
  return jsonb_build_object('ok', true, 'token', v_token, 'name', btrim(v_person));
end;
$$;

-- How many more photos this guest can add.
create or replace function public.guest_photo_left(p_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  s public.guest_photo_sessions%rowtype;
  c jsonb := public.guest_photos_cfg();
  v_mine int;
  v_all int;
begin
  select * into s from public.guest_photo_sessions where token = p_token and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'session');
  end if;
  select count(*) into v_mine from public.guest_photos p
    where p.invitation_id = s.invitation_id and p.guest_id is not distinct from s.guest_id and (p.uploaded or p.slot_expires_at > now());
  select count(*) into v_all from public.guest_photos p where p.uploaded or p.slot_expires_at > now();
  return jsonb_build_object('ok', true, 'name', s.name, 'open', public.guest_photos_open(),
    'left', greatest(0, least((c->>'perGuest')::int - v_mine, (c->>'total')::int - v_all)),
    'mine', v_mine, 'full', v_all >= (c->>'total')::int);
end;
$$;

-- Hands out upload slots (up to 10 at a time) for photos and their thumbnails.
create or replace function public.guest_photo_reserve(p_token text, p_count int)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  s public.guest_photo_sessions%rowtype;
  v_left jsonb;
  v_n int;
  v_id uuid;
  v_slots jsonb := '[]'::jsonb;
begin
  if not public.guest_photos_open() then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  select * into s from public.guest_photo_sessions where token = p_token and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'session');
  end if;
  perform pg_advisory_xact_lock(hashtext('guest_photo_reserve'));
  v_left := public.guest_photo_left(p_token);
  v_n := least(10, greatest(0, coalesce(p_count, 0)), (v_left->>'left')::int);
  if v_n = 0 then
    return jsonb_build_object('ok', false, 'reason', case when (v_left->>'full')::boolean then 'full' else 'limit' end);
  end if;
  for i in 1..v_n loop
    v_id := gen_random_uuid();
    insert into public.guest_photos (id, invitation_id, guest_id, uploader_name, path, thumb_path, slot_expires_at)
    values (v_id, s.invitation_id, s.guest_id, s.name, 'p/' || v_id || '.jpg', 't/' || v_id || '.jpg', now() + interval '30 minutes');
    v_slots := v_slots || jsonb_build_object('id', v_id, 'path', 'p/' || v_id || '.jpg', 'thumb', 't/' || v_id || '.jpg');
  end loop;
  return jsonb_build_object('ok', true, 'slots', v_slots);
end;
$$;

-- After uploading: marks the photos whose two files arrived as added.
create or replace function public.guest_photo_confirm(p_token text, p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  s public.guest_photo_sessions%rowtype;
  v_status text := case when public.guest_photos_cfg()->>'approval' = 'approve' then 'pending' else 'visible' end;
  v_n int;
begin
  select * into s from public.guest_photo_sessions where token = p_token and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'session');
  end if;
  update public.guest_photos p
    set uploaded = true, status = v_status, created_at = now(),
        bytes = coalesce((select (o.metadata->>'size')::bigint from storage.objects o where o.bucket_id = 'guest-photos' and o.name = p.path), 0)
              + coalesce((select (o.metadata->>'size')::bigint from storage.objects o where o.bucket_id = 'guest-photos' and o.name = p.thumb_path), 0)
    where p.id = any(p_ids) and not p.uploaded
      and p.invitation_id = s.invitation_id and p.guest_id is not distinct from s.guest_id
      and exists (select 1 from storage.objects o where o.bucket_id = 'guest-photos' and o.name = p.path)
      and exists (select 1 from storage.objects o where o.bucket_id = 'guest-photos' and o.name = p.thumb_path);
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'added', v_n, 'status', v_status);
end;
$$;

-- "Rina G." — first name and the last name's initial.
create or replace function public.short_guest_name(n text)
returns text language sql immutable set search_path = ''
as $$
  select case when array_length(w, 1) > 1 then w[1] || ' ' || left(w[array_length(w, 1)], 1) || '.' else coalesce(w[1], '') end
  from (select regexp_split_to_array(btrim(coalesce(n, '')), '\s+') w) x;
$$;

-- The gallery: newest first, a page at a time.
create or replace function public.guest_photo_list(p_before timestamptz default null, p_limit int default 60)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when not public.guest_photos_visible() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('id', id, 'path', path, 'thumb', thumb_path, 'by', public.short_guest_name(uploader_name), 'at', created_at) order by created_at desc)
    from (
      select * from public.guest_photos p
      where p.uploaded and p.status = 'visible' and (p_before is null or p.created_at < p_before)
      order by p.created_at desc
      limit least(120, greatest(1, coalesce(p_limit, 60)))
    ) q), '[]'::jsonb) end;
$$;

-- A guest's own photos (including ones waiting for approval).
create or replace function public.guest_photo_mine(p_token text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'thumb', p.thumb_path, 'path', p.path, 'status', p.status) order by p.created_at desc), '[]'::jsonb)
  from public.guest_photo_sessions s
  join public.guest_photos p on p.invitation_id = s.invitation_id and p.guest_id is not distinct from s.guest_id
  where s.token = p_token and s.expires_at > now() and p.uploaded and p.status <> 'hidden';
$$;

-- A guest takes one of their own photos down.
create or replace function public.guest_photo_remove(p_token text, p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_n int;
begin
  update public.guest_photos p set status = 'hidden'
  from public.guest_photo_sessions s
  where s.token = p_token and s.expires_at > now() and p.id = p_id
    and p.invitation_id = s.invitation_id and p.guest_id is not distinct from s.guest_id;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

grant execute on function public.guest_photos_info() to anon, authenticated;
grant execute on function public.guest_photo_start(text) to anon, authenticated;
grant execute on function public.guest_photo_left(text) to anon, authenticated;
grant execute on function public.guest_photo_reserve(text, int) to anon, authenticated;
grant execute on function public.guest_photo_confirm(text, uuid[]) to anon, authenticated;
grant execute on function public.guest_photo_list(timestamptz, int) to anon, authenticated;
grant execute on function public.guest_photo_mine(text) to anon, authenticated;
grant execute on function public.guest_photo_remove(text, uuid) to anon, authenticated;
grant execute on function public.short_guest_name(text) to anon, authenticated;

-- ------------------------------------------------------------------ music
create or replace function public.public_music()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when coalesce((m->>'enabled')::boolean, false) and coalesce(m->>'url', '') ~* '^https://'
    then jsonb_build_object(
      'url', m->>'url',
      'start', greatest(0, coalesce((m->>'start')::numeric, 0)),
      'end', (m->>'end')::numeric,
      'fadeIn', least(10, greatest(0, coalesce((m->>'fadeIn')::numeric, 2))),
      'fadeOut', least(10, greatest(0, coalesce((m->>'fadeOut')::numeric, 2))),
      'loop', coalesce((m->>'loop')::boolean, true),
      'volume', least(1, greatest(0.05, coalesce((m->>'volume')::numeric, 0.4))),
      'pages', case when jsonb_typeof(m->'pages') = 'array' then m->'pages' else '["home","invite"]'::jsonb end,
      'title', coalesce(m->>'title', ''))
    else jsonb_build_object('enabled', false) end
  from (select coalesce((select value from public.admin_preferences where key = 'music'), '{}'::jsonb) m) x;
$$;
grant execute on function public.public_music() to anon, authenticated;
