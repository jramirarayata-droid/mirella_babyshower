-- 013: Groom's side / Bride's side for each invitation.
-- Included guests and approved extra guests follow their invitation's side.
-- Every invitation that existed when this was added belongs to the groom's side.

alter table public.invitations add column if not exists side text not null default 'groom';
alter table public.invitations drop constraint if exists invitations_side_valid;
alter table public.invitations add constraint invitations_side_valid check (side in ('groom', 'bride'));
create index if not exists invitations_side_idx on public.invitations (side);
