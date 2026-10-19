-- 036: Attire inspiration side by side.
--  * wedding_settings.outfit_layout: 'pairs' shows each look for him next to the
--    look for her in the same position (one label for both); 'tabs' keeps the
--    For Him / For Her tabs.
-- Safe to run twice.

alter table public.wedding_settings
  add column if not exists outfit_layout text not null default 'tabs';

alter table public.wedding_settings drop constraint if exists wedding_settings_outfit_layout_valid;
alter table public.wedding_settings add constraint wedding_settings_outfit_layout_valid
  check (outfit_layout in ('tabs', 'pairs'));

-- (No sample looks are added: the attire gallery starts empty.)
