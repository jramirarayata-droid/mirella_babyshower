-- =============================================================================
--  057 — Every section's text is editable (needs 046)
--
--  Admin → Page Order → "Edit text": the small line above each section's
--  title, the title, and the short note under it. Saved per shower as
--  { "<section>": { "eyebrow": "…", "title": "…", "subtitle": "…", "after": "…" } }.
--  Empty = the usual words, so nothing changes until a customer types something.
--  (Titles that already have their own setting — e.g. the photo gallery's —
--  keep using it.)
--
--  Rollback (if ever needed):
--    alter table public.wedding_settings drop column if exists section_text;
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

alter table public.wedding_settings add column if not exists section_text jsonb not null default '{}'::jsonb;
alter table public.wedding_settings drop constraint if exists wedding_settings_section_text_valid;
alter table public.wedding_settings add constraint wedding_settings_section_text_valid
  check (jsonb_typeof(section_text) = 'object' and pg_column_size(section_text) < 16000);

commit;
