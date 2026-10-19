-- 035: A label on each attire photo, and the couple's own attire illustrations.
--  * outfit_images.label: a short tag shown above the caption, e.g. "Principal Sponsors"
--    (website, Admin → Outfit Gallery, printed attire card). Optional.
--  * Replaces the six sample drawings with the couple's illustrations (shipped with
--    the website in public/attire/): Principal Sponsors, Parents & Relatives and
--    Guests — one look for him and one for her each. Photos the couple added
--    themselves are left alone (they move after these three).
-- Run after the website update that adds public/attire/ is live.

alter table public.outfit_images
  add column if not exists label varchar(60);

-- Photos shipped with the website live in public/attire/ (the samples in public/samples/).
alter table public.outfit_images drop constraint if exists outfit_images_url_valid;
alter table public.outfit_images add constraint outfit_images_url_valid
  check (char_length(image_url) between 1 and 1000 and (image_url ~* '^https?://' or image_url ~ '^(samples|attire)/'));

delete from public.outfit_images where image_url like 'samples/outfits/%';

update public.outfit_images set sort_order = sort_order + 3;

insert into public.outfit_images (gender, image_url, caption, label, sort_order, is_visible) values
  ('male',   'attire/sponsors-him.jpg', 'Embroidered barong & taupe trousers', 'Principal Sponsors',  1, true),
  ('male',   'attire/family-him.jpg',   'Ivory barong & brown trousers',       'Parents & Relatives', 2, true),
  ('male',   'attire/guests-him.jpg',   'Polo shirt & beige trousers',         'Guests',              3, true),
  ('female', 'attire/sponsors-her.jpg', 'One-shoulder gown in taupe',          'Principal Sponsors',  1, true),
  ('female', 'attire/family-her.jpg',   'Modern Filipiniana in mocha',         'Parents & Relatives', 2, true),
  ('female', 'attire/guests-her.jpg',   'Puff-sleeve midi dress in cream',     'Guests',              3, true);
