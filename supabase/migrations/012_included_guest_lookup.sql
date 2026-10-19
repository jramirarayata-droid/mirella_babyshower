-- 012: friendly RSVP search for people who are part of someone else's invitation.
--
-- The RSVP search only matches the main name on an invitation. When an included
-- guest (added by the couple, or an approved guest request) types their own name,
-- this returns whose invitation they belong to and whether that party has
-- responded, so the page can say "You're included in X's invitation" instead of
-- "not found". Returns nothing for pending/declined requests or inactive invitations.

create or replace function public.find_included_guest(search_name text)
returns table(invitee_name text, attendance_status text)
language sql stable security definer set search_path = ''
as $$
  select i.invitee_name::text,
         (select r.attendance_status::text from public.rsvp_responses r where r.invitation_id = i.id)
  from public.additional_guests g
  join public.invitations i on i.id = g.invitation_id
  where i.is_active
    and char_length(public.normalize_name(find_included_guest.search_name)) > 0
    and public.normalize_name(g.guest_name) = public.normalize_name(find_included_guest.search_name)
    and (g.added_by = 'admin' or g.status = 'approved')
  order by (g.added_by = 'admin') desc, g.created_at
  limit 1;
$$;

revoke execute on function public.find_included_guest(text) from public;
grant execute on function public.find_included_guest(text) to anon, authenticated;
