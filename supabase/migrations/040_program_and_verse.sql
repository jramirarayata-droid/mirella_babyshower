-- 040: Program flow and a highlighted Bible verse (Admin → Website Settings).
--
-- program_items: the program / order of the day, one row per moment
--   (e.g. "2:00 PM — Ceremony"), in its own table. Shown on the website and
--   available to Printables (leaflets).
-- wedding_settings: switches and titles for the program section, and the
--   Bible verse with its reference.
--
-- Additive only: no existing row or column is changed. Both start HIDDEN
-- (program_visible / verse_visible = false), so the live website looks exactly
-- the same until the couple turns them on.
--
-- Rollback (removes only what this file adds):
--   drop table if exists public.program_items;
--   alter table public.wedding_settings
--     drop column if exists program_visible, drop column if exists program_title,
--     drop column if exists program_subtitle, drop column if exists verse_visible,
--     drop column if exists verse_text, drop column if exists verse_reference;

-- ---------------------------------------------------------------- settings
alter table public.wedding_settings
  add column if not exists program_visible  boolean not null default false,
  add column if not exists program_title    varchar(80),
  add column if not exists program_subtitle varchar(300),
  add column if not exists verse_visible    boolean not null default false,
  add column if not exists verse_text       varchar(1200),
  add column if not exists verse_reference  varchar(120);

-- ---------------------------------------------------------------- program items
create table if not exists public.program_items (
  id          uuid primary key default gen_random_uuid(),
  time_label  varchar(40) not null default '',
  title       varchar(120) not null check (length(btrim(title)) > 0),
  description varchar(300),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists program_items_order_idx on public.program_items (sort_order, created_at);

drop trigger if exists program_items_updated_at on public.program_items;
create trigger program_items_updated_at before update on public.program_items
  for each row execute function public.set_updated_at();

-- Guests can read the program only while it is switched on; admins manage it.
alter table public.program_items enable row level security;
drop policy if exists "Public can view the program while it is shown" on public.program_items;
create policy "Public can view the program while it is shown" on public.program_items
  for select to anon, authenticated
  using (exists (select 1 from public.wedding_settings w where w.program_visible));
drop policy if exists "Admins manage the program" on public.program_items;
create policy "Admins manage the program" on public.program_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.program_items from anon;
grant select on public.program_items to anon;
grant select, insert, update, delete on public.program_items to authenticated;
