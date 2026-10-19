-- 037: The two lists beside the wheel when presenting (host mode).
-- raffle_host_board returns, for the host only:
--   out     — names knocked out in this round (last one standing), in order,
--             leaving out anyone who has won something today;
--   winners — today's results (Philippine time), in order: name, prize, place
--             (place null = a first-spin winner, 1 = last one standing, 2/3 … = consolation).
-- Names are masked exactly like the wheel while the raffle is masked. Read-only.

create or replace function public.raffle_host_board(p_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  cfg jsonb := coalesce((select value from public.admin_preferences where key = 'raffle'), '{}'::jsonb);
  v_round jsonb := coalesce((select value from public.admin_preferences where key = 'raffle_round'), '{}'::jsonb);
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_masked boolean;
  v_out jsonb;
  v_winners jsonb;
begin
  if not public.raffle_host_allowed(p_token) then
    return jsonb_build_object('host', false);
  end if;
  if not public.raffle_is_visible() then
    return jsonb_build_object('host', true, 'visible', false);
  end if;
  v_masked := public.raffle_is_masked();

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', case when v_masked then public.mask_guest_name(d.name) else d.name end,
           'prize', d.prize,
           'place', d.place) order by d.drawn_at, d.place desc nulls last), '[]'::jsonb)
    into v_winners
  from public.raffle_draws d
  where (d.drawn_at at time zone 'Asia/Manila')::date = v_today;

  select coalesce(jsonb_agg(case when v_masked then public.mask_guest_name(e.x) else e.x end order by e.ord), '[]'::jsonb)
    into v_out
  from jsonb_array_elements_text(
         case when coalesce(cfg->>'drawMode', 'first') = 'last' and jsonb_typeof(v_round->'eliminated') = 'array'
              then v_round->'eliminated' else '[]'::jsonb end) with ordinality as e(x, ord)
  where lower(btrim(e.x)) not in (
    select lower(btrim(d.name)) from public.raffle_draws d where (d.drawn_at at time zone 'Asia/Manila')::date = v_today);

  return jsonb_build_object('host', true, 'visible', true, 'out', v_out, 'winners', v_winners);
end;
$$;

revoke all on function public.raffle_host_board(text) from public;
grant execute on function public.raffle_host_board(text) to anon, authenticated;
