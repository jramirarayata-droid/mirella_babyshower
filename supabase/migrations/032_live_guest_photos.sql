-- 032: Live guest photos on the big screen.
-- Whenever a guest photo becomes visible (shared, or approved by an admin) or
-- stops being visible (hidden or deleted), the database sends a tiny
-- "changed" signal on the public Realtime channel "guest-photos". The
-- presentation (#/present/guests) listens and fetches the new photos straight
-- away, instead of waiting for its next regular check.
-- The signal only says how many photos were added/removed. It never carries
-- names, links or ids: the screen still fetches photos through
-- guest_photo_list() as before, so nothing private is exposed.
-- One signal per statement, so a guest sharing 10 photos at once sends one.

create or replace function public.guest_photos_live_signal()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_added int := 0;
  v_removed int := 0;
begin
  if tg_op = 'INSERT' then
    select count(*) into v_added from new_rows n where n.uploaded and n.status = 'visible';
  elsif tg_op = 'DELETE' then
    select count(*) into v_removed from old_rows o where o.uploaded and o.status = 'visible';
  else
    select
      count(*) filter (where (n.uploaded and n.status = 'visible') and not (o.uploaded and o.status = 'visible')),
      count(*) filter (where not (n.uploaded and n.status = 'visible') and (o.uploaded and o.status = 'visible'))
    into v_added, v_removed
    from new_rows n join old_rows o on o.id = n.id;
  end if;

  if v_added > 0 or v_removed > 0 then
    begin
      perform realtime.send(jsonb_build_object('added', v_added, 'removed', v_removed), 'changed', 'guest-photos', false);
    exception when others then
      null; -- a signal that can't be sent must never stop a guest's upload
    end;
  end if;
  return null;
end;
$$;

revoke all on function public.guest_photos_live_signal() from public, anon, authenticated;

drop trigger if exists guest_photos_live_insert on public.guest_photos;
drop trigger if exists guest_photos_live_update on public.guest_photos;
drop trigger if exists guest_photos_live_delete on public.guest_photos;

create trigger guest_photos_live_insert
  after insert on public.guest_photos
  referencing new table as new_rows
  for each statement execute function public.guest_photos_live_signal();

create trigger guest_photos_live_update
  after update on public.guest_photos
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.guest_photos_live_signal();

create trigger guest_photos_live_delete
  after delete on public.guest_photos
  referencing old table as old_rows
  for each statement execute function public.guest_photos_live_signal();
