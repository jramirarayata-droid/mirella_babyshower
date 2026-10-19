-- =============================================================================
--  MIGRATION 004 — couple photo gallery + prenup video highlight
--  Run AFTER 003. Safe to re-run. (Already applied to the live project.)
-- =============================================================================

alter table public.wedding_settings
  add column if not exists gallery_visible boolean not null default true,
  add column if not exists gallery_title text default 'Our Story in Frames',
  add column if not exists gallery_subtitle text default 'A few of our favourite moments together.',
  add column if not exists gallery_layout text not null default 'grid',
  add column if not exists video_visible boolean not null default true,
  add column if not exists video_title text default 'Our Prenup Film',
  add column if not exists video_caption text,
  add column if not exists video_url text default 'samples/video/prenup-sample.mp4',
  add column if not exists video_poster_url text default 'samples/video/prenup-poster.jpg';

alter table public.wedding_settings drop constraint if exists wedding_settings_gallery_layout_valid;
alter table public.wedding_settings add constraint wedding_settings_gallery_layout_valid check (gallery_layout in ('grid', 'carousel'));
alter table public.wedding_settings drop constraint if exists wedding_settings_video_url_valid;
alter table public.wedding_settings add constraint wedding_settings_video_url_valid
  check (video_url is null or video_url ~* '^https://' or video_url ~ '^samples/');
alter table public.wedding_settings drop constraint if exists wedding_settings_video_poster_valid;
alter table public.wedding_settings add constraint wedding_settings_video_poster_valid
  check (video_poster_url is null or video_poster_url ~* '^https://' or video_poster_url ~ '^samples/');

create table if not exists public.gallery_images (
  id          uuid primary key default gen_random_uuid(),
  image_url   text not null,
  caption     varchar(120),
  sort_order  integer not null default 0,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint gallery_images_url_valid check (char_length(image_url) between 1 and 1000 and (image_url ~* '^https://' or image_url ~ '^samples/'))
);
create index if not exists gallery_images_order_idx on public.gallery_images (sort_order);

drop trigger if exists gallery_images_updated_at on public.gallery_images;
create trigger gallery_images_updated_at before update on public.gallery_images for each row execute function public.set_updated_at();

-- Keep storage/bandwidth predictable: at most 30 photos.
create or replace function public.enforce_gallery_limit()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.gallery_images) >= 30 then
    raise exception 'GALLERY_LIMIT_REACHED' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists gallery_images_limit on public.gallery_images;
create trigger gallery_images_limit before insert on public.gallery_images for each row execute function public.enforce_gallery_limit();

alter table public.gallery_images enable row level security;
drop policy if exists "Public can view visible gallery images" on public.gallery_images;
create policy "Public can view visible gallery images" on public.gallery_images for select to anon, authenticated using (is_visible);
drop policy if exists "Admins can read gallery images" on public.gallery_images;
create policy "Admins can read gallery images" on public.gallery_images for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert gallery images" on public.gallery_images;
create policy "Admins can insert gallery images" on public.gallery_images for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins can update gallery images" on public.gallery_images;
create policy "Admins can update gallery images" on public.gallery_images for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins can delete gallery images" on public.gallery_images;
create policy "Admins can delete gallery images" on public.gallery_images for delete to authenticated using (public.is_admin());
revoke all on public.gallery_images from anon;
grant select on public.gallery_images to anon;
grant select, insert, update, delete on public.gallery_images to authenticated;

create or replace function public.log_gallery_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    return coalesce(new, old);
  end if;
  insert into public.admin_activity_logs (admin_user_id, action, target_table, target_id, details)
  values (auth.uid(), case when tg_op = 'INSERT' then 'gallery_photo_added' else 'gallery_photo_removed' end,
          'gallery_images', coalesce(new.id, old.id), jsonb_build_object('caption', coalesce(new.caption, old.caption)));
  return coalesce(new, old);
end;
$$;
drop trigger if exists gallery_images_activity_log on public.gallery_images;
create trigger gallery_images_activity_log after insert or delete on public.gallery_images for each row execute function public.log_gallery_activity();

revoke execute on function public.enforce_gallery_limit() from public, anon, authenticated;
revoke execute on function public.log_gallery_activity() from public, anon, authenticated;

-- Sample photos (free Unsplash images, linked — they use none of your storage).
insert into public.gallery_images (image_url, caption, sort_order)
select * from (values
  ('https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1400&q=80', 'By the sea', 1),
  ('https://images.unsplash.com/photo-1494774157365-9e04c6720e47?auto=format&fit=crop&w=1600&q=80', 'Sunset promise', 2),
  ('https://images.unsplash.com/photo-1591604466107-ec97de577aff?auto=format&fit=crop&w=1600&q=80', 'Golden hour', 3),
  ('https://images.unsplash.com/photo-1501901609772-df0848060b33?auto=format&fit=crop&w=1600&q=80', 'Laughing through it all', 4),
  ('https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1600&q=80', 'The promise', 5),
  ('https://images.unsplash.com/photo-1460978812857-470ed1c77af0?auto=format&fit=crop&w=1600&q=80', 'Forever begins', 6),
  ('https://images.unsplash.com/photo-1532712938310-34cb3982ef74?auto=format&fit=crop&w=1600&q=80', 'Every step together', 7),
  ('https://images.unsplash.com/photo-1550005809-91ad75fb315f?auto=format&fit=crop&w=1600&q=80', 'In bloom', 8),
  ('https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=1600&q=80', 'Hand in hand', 9),
  ('https://images.unsplash.com/photo-1513279922550-250c2129b13a?auto=format&fit=crop&w=1600&q=80', 'Our first sunset', 10)
) as v(image_url, caption, sort_order)
where not exists (select 1 from public.gallery_images);

-- Storage: allow MP4/WebM uploads up to 30 MB for the prenup video.
update storage.buckets
set file_size_limit = 31457280,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm']
where id = 'wedding-assets';
