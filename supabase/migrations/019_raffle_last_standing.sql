-- 019: raffle "last one standing" — places for winners (1 = winner, 2/3 … =
-- consolation), and the public wheel leaves out names already knocked out in
-- the current round (admin preference "raffle_round").

alter table public.raffle_draws add column if not exists place smallint check (place is null or place between 1 and 20);

create or replace function public.raffle_wheel()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg jsonb := coalesce((select value from public.admin_preferences where key = 'raffle'), '{}'::jsonb);
  v_mode text := coalesce(cfg->>'mode', 'hidden');
  v_visible boolean;
  v_masked boolean;
  v_date date := (select s.wedding_date from public.wedding_settings s limit 1);
  v_pool text := coalesce(cfg->>'pool', 'all');
  v_attending boolean := coalesce((cfg->>'attendingOnly')::boolean, false);
  v_remove boolean := coalesce((cfg->>'removeWinners')::boolean, true);
  v_names text[];
  v_round jsonb := coalesce((select value from public.admin_preferences where key = 'raffle_round'), '{}'::jsonb);
begin
  v_visible := case v_mode
    when 'visible' then true
    when 'scheduled' then coalesce(now() >= (cfg->>'from')::timestamptz, false)
    else false end;
  if not v_visible then
    return jsonb_build_object('visible', false);
  end if;

  v_masked := case coalesce(cfg->>'mask', 'auto')
    when 'on' then true
    when 'off' then false
    else v_date is null or (now() at time zone 'Asia/Manila')::date < v_date end;

  select coalesce(array_agg(n order by lower(n)), '{}') into v_names
  from (
    select distinct r.name as n
    from public.raffle_pool_rows() r
    where (v_pool = 'all' or r.side = v_pool)
      and (not v_attending or r.attending)
    union
    select distinct btrim(x) from jsonb_array_elements_text(case when jsonb_typeof(cfg->'extraNames') = 'array' then cfg->'extraNames' else '[]'::jsonb end) x
    where btrim(x) <> ''
  ) all_names
  where lower(n) not in (
      select lower(btrim(x)) from jsonb_array_elements_text(case when jsonb_typeof(cfg->'excluded') = 'array' then cfg->'excluded' else '[]'::jsonb end) x)
    and (not v_remove or lower(n) not in (select lower(btrim(d.name)) from public.raffle_draws d))
    and lower(n) not in (
      select lower(btrim(x)) from jsonb_array_elements_text(case when coalesce(cfg->>'drawMode', 'first') = 'last' and jsonb_typeof(v_round->'eliminated') = 'array' then v_round->'eliminated' else '[]'::jsonb end) x);

  return jsonb_build_object(
    'visible', true,
    'masked', v_masked,
    'names', to_jsonb(case when v_masked then array(select public.mask_guest_name(x) from unnest(v_names) x) else v_names end));
end;
$$;

grant execute on function public.raffle_wheel() to anon, authenticated;
