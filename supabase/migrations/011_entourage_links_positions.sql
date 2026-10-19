-- =============================================================================
--  MIGRATION 011 — entourage ↔ guest links, positions on printed invitations
--  * entourage_links: which invitation (and guest) an entourage name belongs to.
--    Kept in its own admin-only table so invitation IDs never appear in the
--    public website settings.
--  * invitations.position_mode / position_label: show "Maid of Honor" etc. on the
--    printed invitation — automatically from the entourage, typed in, or none.
--  Run AFTER 010. Safe to re-run.
-- =============================================================================

create table if not exists public.entourage_links (
  member_id      text primary key,
  invitation_id  uuid not null references public.invitations(id) on delete cascade,
  guest_id       uuid references public.additional_guests(id) on delete cascade,
  created_at     timestamptz not null default now(),
  constraint entourage_links_member_id_len check (char_length(member_id) between 1 and 80)
);
alter table public.entourage_links enable row level security;
drop policy if exists "Admins manage entourage_links" on public.entourage_links;
create policy "Admins manage entourage_links" on public.entourage_links for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.entourage_links from anon;
grant select, insert, update, delete on public.entourage_links to authenticated;

alter table public.invitations
  add column if not exists position_mode text not null default 'auto',
  add column if not exists position_label varchar(80);
alter table public.invitations drop constraint if exists invitations_position_mode_valid;
alter table public.invitations add constraint invitations_position_mode_valid check (position_mode in ('auto', 'custom', 'none'));
