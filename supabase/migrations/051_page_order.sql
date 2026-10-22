-- =============================================================================
--  051 — Page order (needs 046)
--
--  Admin → Page Order: the customer chooses the order of the sections on their
--  home page (the front page stays first and the footer last). Saved per shower
--  as a list of section keys; empty = the usual order, so nothing changes until
--  a customer moves something. Hidden sections stay hidden.
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

alter table public.wedding_settings add column if not exists page_order text[] not null default '{}';
alter table public.wedding_settings drop constraint if exists wedding_settings_page_order_size;
alter table public.wedding_settings add constraint wedding_settings_page_order_size check (cardinality(page_order) <= 60);

commit;
