-- 029: the couple's own monogram (Look & Feel → Monogram). When switched on it
-- replaces the automatic initials (M & E) on the website and in the printables.
-- public_display_prefs() now also returns the monogram; SVG files are allowed.

update storage.buckets
  set allowed_mime_types = (
    select array_agg(distinct m) from unnest(coalesce(allowed_mime_types, '{}') || array['image/svg+xml']) m)
  where id = 'wedding-assets';

create or replace function public.public_display_prefs()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with p as (
    select
      (select value from public.admin_preferences where key = 'printables') as printables,
      (select value from public.admin_preferences where key = 'virtual_invite') as vi,
      (select value from public.admin_preferences where key = 'website_privacy') as web,
      (select value from public.admin_preferences where key = 'share_preview') as share,
      (select value from public.admin_preferences where key = 'raffle') as raffle,
      (select value from public.admin_preferences where key = 'monogram') as mono
  ), arr as (
    select p.*,
      coalesce(p.vi->>'backMode', 'printables') = 'custom' as custom_back
    from p
  )
  select jsonb_build_object(
    'card', jsonb_build_object(
      'backIds', case
        when custom_back and jsonb_typeof(vi->'backIds') = 'array' then vi->'backIds'
        when not custom_back and jsonb_typeof(printables->'backIds') = 'array' then printables->'backIds'
        else 'null'::jsonb end,
      'boldIds', case
        when custom_back and jsonb_typeof(vi->'boldIds') = 'array' then vi->'boldIds'
        when not custom_back and jsonb_typeof(printables->'boldIds') = 'array' then printables->'boldIds'
        else '[]'::jsonb end,
      'hideVenues', coalesce((vi->>'hideVenues')::boolean, false),
      'hideInfo', coalesce((vi->>'hideInfo')::boolean, false),
      'hideLinks', coalesce((vi->>'hideLinks')::boolean, false)),
    'website', jsonb_build_object(
      'hideVenues', coalesce((web->>'hideVenues')::boolean, false),
      'hideInfo', coalesce((web->>'hideInfo')::boolean, false)),
    'sharePreviewUrl', share->>'url',
    'raffleVisible', case coalesce(raffle->>'mode', 'hidden')
      when 'visible' then true
      when 'scheduled' then coalesce(now() >= (raffle->>'from')::timestamptz, false)
      else false end,
    'monogram', case when coalesce((mono->>'enabled')::boolean, false) and coalesce(mono->>'url', '') ~* '^https://'
      then jsonb_build_object('url', mono->>'url', 'aspect', coalesce((mono->>'aspect')::numeric, 1))
      else null end)
  from arr;
$$;
grant execute on function public.public_display_prefs() to anon, authenticated;
