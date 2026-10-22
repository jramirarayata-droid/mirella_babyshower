-- =============================================================================
--  053 — "No side" for guests (needs 049)
--
--  Guests were always on Dad's ('groom') or Mom's ('bride') side. People who
--  sign up through the open RSVP link aren't on either, so they now get a
--  third value, 'none' ("No side"). The customer can still move them to Mom or
--  Dad at any time, and can choose "No side" when adding someone by hand.
--  A raffle limited to Mom's or Dad's side leaves "No side" guests out;
--  "Everyone" includes them.
--
--  Existing data: only sign-ups that came in through the link (source 'link')
--  and are still on the default Dad's side move to "No side". Everyone else
--  stays exactly as they are.
--
--  Rollback (if ever needed):
--    update public.invitations set side = 'groom' where side = 'none';
--    drop trigger if exists invitations_link_no_side on public.invitations;
--    alter table public.invitations drop constraint invitations_side_valid;
--    alter table public.invitations add constraint invitations_side_valid check (side in ('groom', 'bride'));
--
--  Safe to run twice. Run ONLY in the baby shower project (it stops otherwise).
-- =============================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'spaces') then
    raise exception 'STOP: this is not the baby shower project. Run this only in Mir and Ella Babyshower.';
  end if;
end $$;

-- 1. Allow the third value.
alter table public.invitations drop constraint if exists invitations_side_valid;
alter table public.invitations add constraint invitations_side_valid check (side in ('groom', 'bride', 'none'));

-- 2. New open-link sign-ups start on "No side".
create or replace function public.invitations_link_no_side()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source = 'link' then
    new.side := 'none';
  end if;
  return new;
end;
$$;

drop trigger if exists invitations_link_no_side on public.invitations;
create trigger invitations_link_no_side
  before insert on public.invitations
  for each row execute function public.invitations_link_no_side();

-- 3. Sign-ups already in: from the default Dad's side to "No side".
update public.invitations set side = 'none' where source = 'link' and side = 'groom';

commit;
