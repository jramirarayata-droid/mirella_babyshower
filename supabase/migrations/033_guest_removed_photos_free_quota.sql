-- 033: A photo a guest deletes themselves no longer counts toward their limit.
-- Before: deleting only hid the photo, and hidden photos still counted, so a
-- guest who shared their 10 and deleted some could never share again.
-- Now: guest_photo_remove marks the photo removed_by_guest, and
-- guest_photo_left skips those when counting the guest's own photos.
-- Unchanged on purpose:
--   * photos an admin hides still count (no re-posting a removed photo),
--   * the wedding-wide total still counts everything (the files stay stored).

alter table public.guest_photos
  add column if not exists removed_by_guest boolean not null default false;

-- Photos guests deleted before this fix. (Every hidden photo so far was a
-- guest's own deletion during testing — admins hadn't hidden any yet.)
update public.guest_photos set removed_by_guest = true
  where status = 'hidden' and not removed_by_guest;

create or replace function public.guest_photo_remove(p_token text, p_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_n int;
begin
  update public.guest_photos p set status = 'hidden', removed_by_guest = true
  from public.guest_photo_sessions s
  where s.token = p_token and s.expires_at > now() and p.id = p_id
    and p.invitation_id = s.invitation_id and p.guest_id is not distinct from s.guest_id;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

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
    where p.invitation_id = s.invitation_id and p.guest_id is not distinct from s.guest_id
      and (p.uploaded or p.slot_expires_at > now())
      and not p.removed_by_guest;
  select count(*) into v_all from public.guest_photos p where p.uploaded or p.slot_expires_at > now();
  return jsonb_build_object('ok', true, 'name', s.name, 'open', public.guest_photos_open(),
    'left', greatest(0, least((c->>'perGuest')::int - v_mine, (c->>'total')::int - v_all)),
    'mine', v_mine, 'full', v_all >= (c->>'total')::int);
end;
$$;
