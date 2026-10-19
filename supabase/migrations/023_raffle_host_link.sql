-- 023: present the raffle games from the wedding website with a private host link.
-- Admin → Raffle makes a secret link (#/raffle?host=…) to give the MC. Whoever
-- opens it can spin the prize wheel and run Bingo on the website — only while
-- the raffle is visible — without the admin password. Guests without the link
-- still only see the wheel. A signed-in admin can host too. "New link" makes
-- the old one stop working; "Turn off" disables it.

create table if not exists public.raffle_host (
  id         smallint primary key default 1 check (id = 1),
  token      text check (token is null or length(token) >= 24),
  updated_at timestamptz not null default now()
);
alter table public.raffle_host enable row level security;
revoke all on public.raffle_host from anon, authenticated;

-- ------------------------------------------------------------------ shared helpers (internal)

-- The raffle page is visible right now (Visible, or Visible from a date that has come).
create or replace function public.raffle_is_visible()
returns boolean language sql stable security definer set search_path = ''
as $$
  select case coalesce(cfg->>'mode', 'hidden')
    when 'visible' then true
    when 'scheduled' then coalesce(now() >= (cfg->>'from')::timestamptz, false)
    else false end
  from (select coalesce((select value from public.admin_preferences where key = 'raffle'), '{}'::jsonb) as cfg) c;
$$;

-- Names are masked right now (until the shower day, or always / never).
create or replace function public.raffle_is_masked()
returns boolean language sql stable security definer set search_path = ''
as $$
  select case coalesce(cfg->>'mask', 'auto')
    when 'on' then true
    when 'off' then false
    else d is null or (now() at time zone 'Asia/Manila')::date < d end
  from (select coalesce((select value from public.admin_preferences where key = 'raffle'), '{}'::jsonb) as cfg,
               (select s.wedding_date from public.wedding_settings s limit 1) as d) c;
$$;

-- The real names on the wheel right now (same rules as the admin page and the public wheel).
create or replace function public.raffle_live_names()
returns text[] language plpgsql stable security definer set search_path = ''
as $$
declare
  cfg jsonb := coalesce((select value from public.admin_preferences where key = 'raffle'), '{}'::jsonb);
  v_pool text := coalesce(cfg->>'pool', 'all');
  v_attending boolean := coalesce((cfg->>'attendingOnly')::boolean, false);
  v_remove boolean := coalesce((cfg->>'removeWinners')::boolean, true);
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
      select lower(btrim(x)) from jsonb_array_elements_text(case when coalesce(cfg->>'drawMode', 'first') = 'last' and jsonb_typeof(v_round->'eliminated') = 'array' then v_round->'eliminated' else '[]'::jsonb end) x);
  return v_names;
end;
$$;

-- The caller may host: a signed-in admin, or someone with the current host link.
create or replace function public.raffle_host_allowed(p_token text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or (p_token is not null and length(p_token) >= 24
          and exists (select 1 from public.raffle_host h where h.token is not null and h.token = p_token));
$$;

revoke all on function public.raffle_is_visible() from public, anon, authenticated;
revoke all on function public.raffle_is_masked() from public, anon, authenticated;
revoke all on function public.raffle_live_names() from public, anon, authenticated;
revoke all on function public.raffle_host_allowed(text) from public, anon, authenticated;

-- The public wheel now shares the same rules (unchanged result).
create or replace function public.raffle_wheel()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  v_masked boolean;
  v_names text[];
begin
  if not public.raffle_is_visible() then
    return jsonb_build_object('visible', false);
  end if;
  v_masked := public.raffle_is_masked();
  v_names := public.raffle_live_names();
  return jsonb_build_object(
    'visible', true,
    'masked', v_masked,
    'names', to_jsonb(case when v_masked then array(select public.mask_guest_name(x) from unnest(v_names) x) else v_names end));
end;
$$;
grant execute on function public.raffle_wheel() to anon, authenticated;

-- ------------------------------------------------------------------ admin: the host link

-- p_action: 'get' (make one if there's none), 'new' (replace it), 'off' (turn it off). Returns the token or null.
create or replace function public.raffle_host_token(p_action text default 'get')
returns text language plpgsql security definer set search_path = ''
as $$
declare
  v_token text;
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  insert into public.raffle_host (id) values (1) on conflict (id) do nothing;
  if p_action = 'off' then
    update public.raffle_host set token = null, updated_at = now() where id = 1;
    return null;
  end if;
  select token into v_token from public.raffle_host where id = 1;
  if p_action = 'new' or v_token is null then
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.raffle_host set token = v_token, updated_at = now() where id = 1;
  end if;
  return v_token;
end;
$$;

-- Admin: is a host link on (without making one)?
create or replace function public.raffle_host_link_on()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin() and exists (select 1 from public.raffle_host where token is not null);
$$;

revoke all on function public.raffle_host_token(text) from public, anon;
revoke all on function public.raffle_host_link_on() from public, anon;
grant execute on function public.raffle_host_token(text) to authenticated;
grant execute on function public.raffle_host_link_on() to authenticated;

-- ------------------------------------------------------------------ host: present on the website

-- What the host needs to run the wheel. Names come with a key (no real names when masked).
create or replace function public.raffle_host_state(p_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  cfg jsonb := coalesce((select value from public.admin_preferences where key = 'raffle'), '{}'::jsonb);
  v_masked boolean;
  v_names text[];
  v_round jsonb := coalesce((select value from public.admin_preferences where key = 'raffle_round'), '{}'::jsonb);
begin
  if not public.raffle_host_allowed(p_token) then
    return jsonb_build_object('host', false);
  end if;
  if not public.raffle_is_visible() then
    return jsonb_build_object('host', true, 'visible', false);
  end if;
  v_masked := public.raffle_is_masked();
  v_names := public.raffle_live_names();
  return jsonb_build_object(
    'host', true,
    'visible', true,
    'masked', v_masked,
    'drawMode', coalesce(cfg->>'drawMode', 'first'),
    'consolations', least(10, greatest(0, coalesce((cfg->>'consolations')::int, 2))),
    'finalsAt', least(20, greatest(2, coalesce((cfg->>'finalsAt')::int, 5))),
    'prizes', case when jsonb_typeof(cfg->'prizes') = 'array' then cfg->'prizes' else '[]'::jsonb end,
    'knockedOut', case when coalesce(cfg->>'drawMode', 'first') = 'last' and jsonb_typeof(v_round->'eliminated') = 'array' then jsonb_array_length(v_round->'eliminated') else 0 end,
    'names', coalesce((
      select jsonb_agg(jsonb_build_object('k', md5(lower(x)), 'n', case when v_masked then public.mask_guest_name(x) else x end) order by ord)
      from unnest(v_names) with ordinality as u(x, ord)), '[]'::jsonb));
end;
$$;

-- The wheel landed on the name with key p_key: save the result and say what happened.
create or replace function public.raffle_host_land(p_token text, p_key text, p_prize text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  cfg jsonb := coalesce((select value from public.admin_preferences where key = 'raffle'), '{}'::jsonb);
  v_last boolean := coalesce(cfg->>'drawMode', 'first') = 'last';
  v_cons int := least(10, greatest(0, coalesce((cfg->>'consolations')::int, 2)));
  v_masked boolean := public.raffle_is_masked();
  v_names text[];
  v_name text;
  v_other text;
  v_left int;
  v_place int;
  v_prize text;
  v_win_prize text;
  v_then jsonb;
begin
  if not public.raffle_host_allowed(p_token) then
    raise exception 'NOT_HOST' using errcode = '42501';
  end if;
  if not public.raffle_is_visible() then
    raise exception 'RAFFLE_HIDDEN' using errcode = '22023';
  end if;
  v_names := public.raffle_live_names();
  select x into v_name from unnest(v_names) x where md5(lower(x)) = p_key limit 1;
  if v_name is null then
    raise exception 'NAME_GONE' using errcode = '22023';
  end if;

  if not v_last then
    v_prize := nullif(left(btrim(coalesce(p_prize, '')), 150), '');
    insert into public.raffle_draws (name, prize, place) values (left(v_name, 150), v_prize, null);
    return jsonb_build_object('tone', 'winner', 'title', 'Winner',
      'name', case when v_masked then public.mask_guest_name(v_name) else v_name end, 'detail', v_prize);
  end if;

  -- Last one standing: this name is out.
  v_left := coalesce(array_length(v_names, 1), 0);
  v_place := case when v_left between 2 and v_cons + 1 then v_left end;
  insert into public.admin_preferences as ap (key, value) values ('raffle_round', jsonb_build_object('eliminated', jsonb_build_array(v_name)))
  on conflict (key) do update set
    value = jsonb_build_object('eliminated',
      (case when jsonb_typeof(ap.value->'eliminated') = 'array' then ap.value->'eliminated' else '[]'::jsonb end) || to_jsonb(v_name)),
    updated_at = now();
  if v_place is not null then
    v_prize := nullif(btrim(coalesce(cfg->'prizes'->>(v_place - 1), '')), '');
    insert into public.raffle_draws (name, prize, place) values (left(v_name, 150), left(v_prize, 150), v_place);
  end if;
  if v_left - 1 = 1 then
    select x into v_other from unnest(v_names) x where x <> v_name limit 1;
    if v_other is not null then
      v_win_prize := nullif(btrim(coalesce(cfg->'prizes'->>0, '')), '');
      insert into public.raffle_draws (name, prize, place) values (left(v_other, 150), left(v_win_prize, 150), 1);
      v_then := jsonb_build_object('tone', 'winner', 'title', 'Winner — last one standing',
        'name', case when v_masked then public.mask_guest_name(v_other) else v_other end, 'detail', v_win_prize);
    end if;
  end if;
  return jsonb_build_object(
    'tone', case when v_place is not null then 'place' else 'out' end,
    'title', case when v_place is not null then v_place || (case when v_place % 100 in (11, 12, 13) then 'th' when v_place % 10 = 1 then 'st' when v_place % 10 = 2 then 'nd' when v_place % 10 = 3 then 'rd' else 'th' end) || ' place' else 'Out' end,
    'name', case when v_masked then public.mask_guest_name(v_name) else v_name end,
    'detail', case when v_place is not null then v_prize else (v_left - 1) || ' left' end,
    'then', v_then);
end;
$$;

-- Last one standing: everyone knocked out comes back (winners stay saved).
create or replace function public.raffle_host_new_round(p_token text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.raffle_host_allowed(p_token) then
    raise exception 'NOT_HOST' using errcode = '42501';
  end if;
  if not public.raffle_is_visible() then
    raise exception 'RAFFLE_HIDDEN' using errcode = '22023';
  end if;
  insert into public.admin_preferences (key, value) values ('raffle_round', '{"eliminated": []}'::jsonb)
  on conflict (key) do update set value = '{"eliminated": []}'::jsonb, updated_at = now();
end;
$$;

grant execute on function public.raffle_host_state(text) to anon, authenticated;
grant execute on function public.raffle_host_land(text, text, text) to anon, authenticated;
grant execute on function public.raffle_host_new_round(text) to anon, authenticated;
