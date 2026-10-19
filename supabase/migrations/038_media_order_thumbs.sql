-- 038: Photo & video order on the website, and small copies of photos.
--
-- wedding_settings.media_order: the order of the photo and video sections on
--   the home page — 'gallery' (the main photo gallery), 'video' (the main
--   film) and the ids of the extra sections. Empty = the old order (main
--   gallery, main video, then the extra sections). Nothing existing changes.
--
-- gallery_images.thumb_url: a small copy (about 800 px) of each photo, shown
--   in the gallery grids; the full photo is still used when a guest opens it.
--   Empty = no small copy yet (the full photo is used, as before).

alter table public.wedding_settings
  add column if not exists media_order jsonb not null default '[]'::jsonb;

alter table public.wedding_settings
  drop constraint if exists wedding_settings_media_order_array;
alter table public.wedding_settings
  add constraint wedding_settings_media_order_array check (jsonb_typeof(media_order) = 'array');

alter table public.gallery_images
  add column if not exists thumb_url text;
