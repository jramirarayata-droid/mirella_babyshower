-- 017: the RSVP page uses the same envelope and card as the virtual invitation.
--
--   card_back_prefs()           → which "Good to know" sections are ticked in
--                                 Printables (and which titles are bold), so the
--                                 on-screen card back matches the printed one.
--                                 Only those two lists are shared — nothing else
--                                 from the admin preferences.
--   invitation_card_details(id) → the invitee's position for the card
--                                 (e.g. "Groom's Mother").
--   record_invitation_open(id)  → counts opening the envelope on the RSVP page
--                                 as "Opened" (admins aren't counted).
--
-- The invitation id is only known to someone who found that invitation
-- (by name or personal code), so these reveal nothing new.

create or replace function public.card_back_prefs()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object(
              'backIds', case when jsonb_typeof(p.value->'backIds') = 'array' then p.value->'backIds' else 'null'::jsonb end,
              'boldIds', case when jsonb_typeof(p.value->'boldIds') = 'array' then p.value->'boldIds' else '[]'::jsonb end)
     from public.admin_preferences p
     where p.key = 'printables'),
    jsonb_build_object('backIds', null, 'boldIds', '[]'::jsonb));
$$;

create or replace function public.invitation_card_details(p_invitation_id uuid)
returns table (position_mode text, position_label text, position_member_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(i.position_mode, 'auto')::text,
         i.position_label::text,
         (select l.member_id::text from public.entourage_links l
           where l.invitation_id = i.id and l.guest_id is null
           order by l.created_at limit 1)
  from public.invitations i
  where i.id = p_invitation_id and i.is_active;
$$;

create or replace function public.record_invitation_open(p_invitation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return;
  end if;
  if not exists (select 1 from public.invitations i where i.id = p_invitation_id and i.is_active) then
    return;
  end if;
  insert into public.invitation_opens as o (invitation_id)
  values (p_invitation_id)
  on conflict (invitation_id) do update
    set last_opened_at = now(), open_count = o.open_count + 1;
end;
$$;

revoke all on function public.card_back_prefs() from public;
revoke all on function public.invitation_card_details(uuid) from public;
revoke all on function public.record_invitation_open(uuid) from public;
grant execute on function public.card_back_prefs() to anon, authenticated;
grant execute on function public.invitation_card_details(uuid) to anon, authenticated;
grant execute on function public.record_invitation_open(uuid) to anon, authenticated;
