-- 014: eight more photo gallery layouts for the home page.
alter table public.wedding_settings drop constraint if exists wedding_settings_gallery_layout_valid;
alter table public.wedding_settings add constraint wedding_settings_gallery_layout_valid
  check (gallery_layout in ('grid', 'carousel', 'polaroid', 'filmstrip', 'mosaic', 'story', 'deck', 'coverflow', 'arches', 'timeline'));
