-- =============================================================================
--  041 — Baby shower basics
--  Run after 040. Safe to run twice. Only adds columns and changes defaults;
--  nothing is deleted.
--
--  * wedding_settings (the table keeps its internal name; guests never see it):
--      baby_name     the baby's name or nickname, e.g. "Baby Santos"
--      due_date      optional due date (only the month is shown by default)
--      due_text      optional own wording, e.g. "Arriving: February 2027"
--                    ('' or null = made from due_date)
--      due_visible   show the due date on the website
--    couple_names now holds the parents' names; church_* is the one venue
--    (reception_* is no longer used); wedding_date is the shower date.
--  * The entourage is not part of a baby shower: hidden by default.
--  * Wording defaults for a baby shower.
-- =============================================================================

alter table public.wedding_settings
  add column if not exists baby_name   varchar(60) not null default 'Baby',
  add column if not exists due_date    date,
  add column if not exists due_text    varchar(80),
  add column if not exists due_visible boolean not null default true;

alter table public.wedding_settings alter column entourage_visible set default false;
update public.wedding_settings set entourage_visible = false;

-- The default row (schema.sql) carries the test information.
update public.wedding_settings
set baby_name = 'Baby Santos'
where baby_name = 'Baby' and hero_title = 'Baby Santos';

update public.wedding_settings
set due_date = '2027-04-20'
where due_date is null and baby_name = 'Baby Santos';
