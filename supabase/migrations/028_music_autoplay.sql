-- 028: music — try to start without a tap ("autoplay"), and an optional
-- "Tap to enter" welcome screen on the home page (always works).
-- public_music() now also returns autoplay and welcome. (Applied live.)
create or replace function public.public_music()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when coalesce((m->>'enabled')::boolean, false) and coalesce(m->>'url', '') ~* '^https://'
    then jsonb_build_object(
      'url', m->>'url',
      'start', greatest(0, coalesce((m->>'start')::numeric, 0)),
      'end', (m->>'end')::numeric,
      'fadeIn', least(10, greatest(0, coalesce((m->>'fadeIn')::numeric, 2))),
      'fadeOut', least(10, greatest(0, coalesce((m->>'fadeOut')::numeric, 2))),
      'loop', coalesce((m->>'loop')::boolean, true),
      'volume', least(1, greatest(0.05, coalesce((m->>'volume')::numeric, 0.4))),
      'pages', case when jsonb_typeof(m->'pages') = 'array' then m->'pages' else '["home","invite"]'::jsonb end,
      'autoplay', coalesce((m->>'autoplay')::boolean, false),
      'welcome', coalesce((m->>'welcome')::boolean, false),
      'title', coalesce(m->>'title', ''))
    else jsonb_build_object('enabled', false) end
  from (select coalesce((select value from public.admin_preferences where key = 'music'), '{}'::jsonb) m) x;
$$;
grant execute on function public.public_music() to anon, authenticated;
