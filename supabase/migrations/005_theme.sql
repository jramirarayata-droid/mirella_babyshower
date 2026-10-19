-- =============================================================================
--  MIGRATION 005 — Look & Feel (template, fonts, colours, hero layout)
--  Run AFTER 004. Safe to re-run. (Already applied to the live project.)
-- =============================================================================
alter table public.wedding_settings
  add column if not exists theme jsonb not null default '{"template": "classic"}'::jsonb;

alter table public.wedding_settings drop constraint if exists wedding_settings_theme_is_object;
alter table public.wedding_settings add constraint wedding_settings_theme_is_object
  check (jsonb_typeof(theme) = 'object' and pg_column_size(theme) < 2000);
