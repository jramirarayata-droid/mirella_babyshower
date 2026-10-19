-- =============================================================================
--  MIGRATION 010 — optional ceremony / reception times (e.g. "3:00 PM")
--  Shown on the home page venue cards, printed invitations and the envelope.
--  Run AFTER 009. Safe to re-run.
-- =============================================================================
alter table public.wedding_settings
  add column if not exists ceremony_time varchar(40),
  add column if not exists reception_time varchar(40);
