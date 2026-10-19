-- 024: host the raffle games from the wedding website with a 4-digit code.
-- Admin → Raffle → Host access sets a code. On the Raffle page (while it's
-- visible) the host taps "I'm the host", types the code, and gets the Spin /
-- Draw / Present controls for that browser tab. The private link still works.
-- Wrong codes: after 10 in 15 minutes, codes are refused for 15 minutes
-- (a host already signed in with the code isn't affected). Changing or
-- removing the code signs out everyone who used the old one.

alter table public.raffle_host add column if not exists pin text check (pin is null or pin ~ '^[0-9]{4}$');
alter table public.raffle_host add column if not exists pin_version integer not null default 0;
alter table public.raffle_host add column if not exists failed_count integer not null default 0;
alter table public.raffle_host add column if not exists failed_since timestamptz;
alter table public.raffle_host add column if not exists locked_until timestamptz;

-- Hosts signed in with the code (one row per browser tab, valid for a day).
create table if not exists public.raffle_host_sessions (
  token       text primary key check (length(token) >= 24),
  pin_version integer not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
alter table public.raffle_host_sessions enable row level security;
revoke all on public.raffle_host_sessions from anon, authenticated;

-- Admin, the private link, or a code session that's still current.
create or replace function public.raffle_host_allowed(p_token text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or (p_token is not null and length(p_token) >= 24 and (
            exists (select 1 from public.raffle_host h where h.token is not null and h.token = p_token)
         or exists (select 1 from public.raffle_host_sessions s
                    join public.raffle_host h on h.id = 1
                    where s.token = p_token and s.expires_at > now()
                      and h.pin is not null and s.pin_version = h.pin_version)));
$$;
revoke all on function public.raffle_host_allowed(text) from public, anon, authenticated;

-- Public: type the code. Returns {ok, token} or {ok:false, reason: wrong | locked | off | hidden, left?}.
create or replace function public.raffle_host_code_login(p_pin text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  h public.raffle_host%rowtype;
  v_token text;
  v_count int;
begin
  if not public.raffle_is_visible() then
    return jsonb_build_object('ok', false, 'reason', 'hidden');
  end if;
  select * into h from public.raffle_host where id = 1 for update;
  if not found or h.pin is null then
    return jsonb_build_object('ok', false, 'reason', 'off');
  end if;
  if h.locked_until is not null and h.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'minutes', ceil(extract(epoch from (h.locked_until - now())) / 60));
  end if;
  if coalesce(p_pin, '') <> h.pin then
    v_count := case when h.failed_since is null or h.failed_since < now() - interval '15 minutes' then 1 else h.failed_count + 1 end;
    if v_count >= 10 then
      update public.raffle_host set failed_count = 0, failed_since = null, locked_until = now() + interval '15 minutes' where id = 1;
      return jsonb_build_object('ok', false, 'reason', 'locked', 'minutes', 15);
    end if;
    update public.raffle_host
      set failed_count = v_count, failed_since = case when v_count = 1 then now() else h.failed_since end
      where id = 1;
    return jsonb_build_object('ok', false, 'reason', 'wrong', 'left', 10 - v_count);
  end if;
  update public.raffle_host set failed_count = 0, failed_since = null, locked_until = null where id = 1;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.raffle_host_sessions (token, pin_version, expires_at) values (v_token, h.pin_version, now() + interval '1 day');
  return jsonb_build_object('ok', true, 'token', v_token);
end;
$$;
grant execute on function public.raffle_host_code_login(text) to anon, authenticated;

-- Admin: set the code ('1234'), or null / '' to turn it off. Signs out old code sessions.
create or replace function public.raffle_host_set_code(p_pin text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN' using errcode = '42501';
  end if;
  if coalesce(p_pin, '') <> '' and p_pin !~ '^[0-9]{4}$' then
    raise exception 'BAD_CODE' using errcode = '22023';
  end if;
  insert into public.raffle_host (id) values (1) on conflict (id) do nothing;
  update public.raffle_host
    set pin = nullif(p_pin, ''), pin_version = pin_version + 1,
        failed_count = 0, failed_since = null, locked_until = null, updated_at = now()
    where id = 1;
end;
$$;

-- Admin: the host access settings.
create or replace function public.raffle_host_status()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  h public.raffle_host%rowtype;
begin
  if not public.is_admin() then
    return null;
  end if;
  select * into h from public.raffle_host where id = 1;
  return jsonb_build_object(
    'link', coalesce(h.token is not null, false),
    'code', h.pin,
    'lockedUntil', case when h.locked_until > now() then h.locked_until end);
end;
$$;

revoke all on function public.raffle_host_set_code(text) from public, anon;
revoke all on function public.raffle_host_status() from public, anon;
grant execute on function public.raffle_host_set_code(text) to authenticated;
grant execute on function public.raffle_host_status() to authenticated;

-- The public wheel also says whether a host code is set (so the page can offer "I'm the host").
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
    'hostCode', exists (select 1 from public.raffle_host where id = 1 and pin is not null),
    'names', to_jsonb(case when v_masked then array(select public.mask_guest_name(x) from unnest(v_names) x) else v_names end));
end;
$$;
grant execute on function public.raffle_wheel() to anon, authenticated;
