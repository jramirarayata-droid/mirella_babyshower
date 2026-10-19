-- 026: Last one standing — a new round starts with everyone on the wheel again,
-- including past winners ("Take winners off the wheel" is for First spin wins).
-- raffle_live_names(): v_remove now also requires drawMode <> 'last'.
-- (Applied live; same body as 023 with that one change.)

create or replace function public.raffle_live_names()
returns text[] language plpgsql stable security definer set search_path = ''
as $$
declare
  cfg jsonb := coalesce((select value from public.admin_preferences where key = 'raffle'), '{}'::jsonb);
  v_pool text := coalesce(cfg->>'pool', 'all');
  v_attending boolean := coalesce((cfg->>'attendingOnly')::boolean, false);
  v_last boolean := coalesce(cfg->>'drawMode', 'first') = 'last';
  v_remove boolean := coalesce((cfg->>'removeWinners')::boolean, true) and not v_last;
  v_round jsonb := coalesce((select value from public.admin_preferences where key = 'raffle_round'), '{}'::jsonb);
  v_names text[];
begin
  select coalesce(array_agg(n order by lower(n)), '{}') into v_names
  from (
    select distinct on (lower(x.n)) x.n
    from (
      select r.name as n from public.raffle_pool_rows() r
      where (v_pool = 'all' or r.side = v_pool) and (not v_attending or r.attending)
      union all
      select btrim(e) from jsonb_array_elements_text(case when jsonb_typeof(cfg->'extraNames') = 'array' then cfg->'extraNames' else '[]'::jsonb end) e
      where btrim(e) <> ''
    ) x
    order by lower(x.n), x.n
  ) all_names
  where lower(n) not in (
      select lower(btrim(x)) from jsonb_array_elements_text(case when jsonb_typeof(cfg->'excluded') = 'array' then cfg->'excluded' else '[]'::jsonb end) x)
    and (not v_remove or lower(n) not in (select lower(btrim(d.name)) from public.raffle_draws d))
    and lower(n) not in (
      select lower(btrim(x)) from jsonb_array_elements_text(case when v_last and jsonb_typeof(v_round->'eliminated') = 'array' then v_round->'eliminated' else '[]'::jsonb end) x);
  return v_names;
end;
$$;

revoke all on function public.raffle_live_names() from public, anon, authenticated;
