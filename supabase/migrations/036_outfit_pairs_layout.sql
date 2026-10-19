-- 036: Attire inspiration side by side, and a fourth look.
--  * wedding_settings.outfit_layout: 'pairs' shows each look for him next to the
--    look for her in the same position (one label for both); 'tabs' keeps the
--    For Him / For Her tabs. This wedding switches to 'pairs'.
--  * Adds the couple's fourth look (public/attire/look4-him.jpg and look4-her.jpg)
--    after the existing ones. No label yet — set it in Admin → Outfit Gallery → Pairs.
-- Run after the website update that adds public/attire/look4-*.jpg is live.
-- Safe to run twice.

alter table public.wedding_settings
  add column if not exists outfit_layout text not null default 'tabs';

alter table public.wedding_settings drop constraint if exists wedding_settings_outfit_layout_valid;
alter table public.wedding_settings add constraint wedding_settings_outfit_layout_valid
  check (outfit_layout in ('tabs', 'pairs'));

update public.wedding_settings set outfit_layout = 'pairs';

insert into public.outfit_images (gender, image_url, caption, sort_order, is_visible)
select 'male', 'attire/look4-him.jpg', 'Cream turtleneck with long sleeves',
       coalesce((select max(sort_order) from public.outfit_images where gender = 'male'), 0) + 1, true
where not exists (select 1 from public.outfit_images where image_url = 'attire/look4-him.jpg');

insert into public.outfit_images (gender, image_url, caption, sort_order, is_visible)
select 'female', 'attire/look4-her.jpg', 'Beige dress with regular sleeves',
       coalesce((select max(sort_order) from public.outfit_images where gender = 'female'), 0) + 1, true
where not exists (select 1 from public.outfit_images where image_url = 'attire/look4-her.jpg');
