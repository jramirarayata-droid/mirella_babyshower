-- =============================================================================
--  052 — Venue section title (needs 046)
--
--  Website settings → Venue: the customer can change the venue section's
--  heading ("The Shower") and the small line above it ("Where"). Empty = the
--  usual words, so nothing changes until a customer types something.
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

alter table public.wedding_settings add column if not exists venue_title text;
alter table public.wedding_settings add column if not exists venue_eyebrow text;
alter table public.wedding_settings drop constraint if exists wedding_settings_venue_title_len;
alter table public.wedding_settings add constraint wedding_settings_venue_title_len
  check ((venue_title is null or char_length(venue_title) <= 60) and (venue_eyebrow is null or char_length(venue_eyebrow) <= 40));

commit;
