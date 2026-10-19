-- 016: virtual invitation link (/#/i/<code>) and "who opened it".
--
-- Opens are kept in their own small table (not on invitations), so opening a
-- link never touches the invitation's "updated" time or the activity log.
-- Only admins can see or clear them; guests record an open through the
-- open_invitation() function, which also returns what the page needs.
-- Opens by a signed-in admin (e.g. testing a link) are not counted.

create table if not exists public.invitation_opens (
  invitation_id uuid primary key references public.invitations(id) on delete cascade,
  first_opened_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  open_count integer not null default 1
);

alter table public.invitation_opens enable row level security;

drop policy if exists "Admins can read invitation opens" on public.invitation_opens;
create policy "Admins can read invitation opens" on public.invitation_opens for select to authenticated using (public.is_admin());
drop policy if exists "Admins can clear invitation opens" on public.invitation_opens;
create policy "Admins can clear invitation opens" on public.invitation_opens for delete to authenticated using (public.is_admin());

revoke all on public.invitation_opens from anon;
grant select, delete on public.invitation_opens to authenticated;

-- Public: the virtual invitation for one personal code (nothing about other guests).
create or replace function public.open_invitation(invite_code text)
returns table (
  invitee_name text,
  included_guests text[],
  attendance_status text,
  position_mode text,
  position_label text,
  position_member_id text
)
language plpgsql
volatile
security definer
set search_path = ''
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
      order by l.created_at limit 1)
  from public.invitations i
  where i.id = v_id;
end;
$$;

revoke all on function public.open_invitation(text) from public;
grant execute on function public.open_invitation(text) to anon, authenticated;
