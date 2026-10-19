-- 035: A label on each attire photo.
--  * outfit_images.label: a short tag shown above the caption, e.g. "Team Pink"
--    (website, Admin → Outfit Gallery, printed attire card). Optional.

alter table public.outfit_images
  add column if not exists label varchar(60);

-- Photos shipped with the website live in public/attire/ (the samples in public/samples/).
alter table public.outfit_images drop constraint if exists outfit_images_url_valid;
alter table public.outfit_images add constraint outfit_images_url_valid
  check (char_length(image_url) between 1 and 1000 and (image_url ~* '^https?://' or image_url ~ '^(samples|attire)/'));

-- (The wedding site's attire photos are not part of this site.)
