-- 015: admin-only preferences (e.g. the Printables setup), so choices are remembered across visits and devices.
create table if not exists public.admin_preferences (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.admin_preferences enable row level security;

drop policy if exists "Admins can read preferences" on public.admin_preferences;
create policy "Admins can read preferences" on public.admin_preferences for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert preferences" on public.admin_preferences;
create policy "Admins can insert preferences" on public.admin_preferences for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins can update preferences" on public.admin_preferences;
create policy "Admins can update preferences" on public.admin_preferences for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins can delete preferences" on public.admin_preferences;
create policy "Admins can delete preferences" on public.admin_preferences for delete to authenticated using (public.is_admin());

grant select, insert, update, delete on public.admin_preferences to authenticated;
