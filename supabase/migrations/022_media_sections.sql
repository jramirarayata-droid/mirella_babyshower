-- 022: extra photo and video sections on the home page (Admin → Photos & Video →
-- "More sections"). Each section is either photos (its own layout, up to 30
-- photos, stored in gallery_images with section_id) or one video. The main
-- gallery keeps its photos (section_id null) exactly as before.

create table if not exists public.media_sections (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('photos', 'video')),
  title       varchar(120) not null default '',
  subtitle    varchar(300),
  layout      text not null default 'grid',
  video_url   text check (video_url is null or video_url ~* '^https://' or video_url ~ '^samples/'),
  poster_url  text check (poster_url is null or poster_url ~* '^https://' or poster_url ~ '^samples/'),
  is_visible  boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger media_sections_updated_at before update on public.media_sections
  for each row execute function public.set_updated_at();

alter table public.media_sections enable row level security;
create policy "Public can view visible media sections" on public.media_sections for select to anon, authenticated using (is_visible);
create policy "Admins manage media sections" on public.media_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.media_sections from anon;
grant select on public.media_sections to anon;
grant select, insert, update, delete on public.media_sections to authenticated;

-- Photos belong to the main gallery (null) or to one extra section.
alter table public.gallery_images add column if not exists section_id uuid references public.media_sections(id) on delete cascade;
create index if not exists gallery_images_section_idx on public.gallery_images (section_id, sort_order);

-- At most 30 photos per gallery (the main one and each extra section).
create or replace function public.enforce_gallery_limit()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.gallery_images g where g.section_id is not distinct from new.section_id) >= 30 then
    raise exception 'GALLERY_LIMIT_REACHED' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- At most 12 extra sections.
create or replace function public.enforce_media_section_limit()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.media_sections) >= 12 then
    raise exception 'MEDIA_SECTION_LIMIT' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger media_sections_limit before insert on public.media_sections
  for each row execute function public.enforce_media_section_limit();
