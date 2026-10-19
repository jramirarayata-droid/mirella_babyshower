-- 034: "Addressed as" — how an invitation is addressed, e.g. "Mr. & Mrs. Juan dela Cruz".
-- Set one by one in Admin → Printables. When set, it replaces the invitee's name
-- and the "together with …" line, both on the printed card and on the guest's
-- online invitation (envelope and card). Empty = the usual name + "together with".
-- open_invitation and invitation_card return it; their result columns change, so
-- they are dropped and recreated with the same permissions as before.

alter table public.invitations
  add column if not exists addressed_as varchar(120);

alter table public.invitations drop constraint if exists invitations_addressed_as_trimmed;
alter table public.invitations add constraint invitations_addressed_as_trimmed
  check (addressed_as is null or (addressed_as = btrim(addressed_as) and addressed_as <> ''));

-- The virtual invitation (#/i/<code>).
drop function if exists public.open_invitation(text);
create function public.open_invitation(invite_code text)
returns table(invitee_name text, included_guests text[], attendance_status text, position_mode text, position_label text, position_member_id text, addressed_as text)
language plpgsql security definer set search_path = ''
as $$
declare
  v_code text := btrim(coalesce(open_invitation.invite_code, ''));
  v_id uuid;
begin
  if v_code = '' or length(v_code) > 64 then
    return;
  end if;

  select i.id into v_id
  from public.invitations i
  where i.is_active and i.invitation_code = v_code
  limit 1;

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

-- The envelope and card on the RSVP page (invitations found by name or code).
drop function if exists public.invitation_card(uuid);
create function public.invitation_card(p_invitation_id uuid)
returns table(position_mode text, position_label text, position_member_id text, attendance_status text, addressed_as text)
language sql stable security definer set search_path = ''
as $$
  select coalesce(i.position_mode, 'auto')::text,
         i.position_label::text,
         (select l.member_id::text from public.entourage_links l
           where l.invitation_id = i.id and l.guest_id is null
           order by l.created_at limit 1),
         (select r.attendance_status::text from public.rsvp_responses r where r.invitation_id = i.id limit 1),
         i.addressed_as::text
  from public.invitations i
  where i.id = p_invitation_id and i.is_active;
$$;

revoke all on function public.open_invitation(text) from public;
revoke all on function public.invitation_card(uuid) from public;
grant execute on function public.open_invitation(text) to anon, authenticated;
grant execute on function public.invitation_card(uuid) to anon, authenticated;
