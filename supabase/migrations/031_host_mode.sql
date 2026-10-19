-- 031: Host mode for the whole website.
-- The same 4-digit host code (Admin → Raffle → Host access) now unlocks host
-- mode anywhere on the site, even while the raffle is hidden: the raffle and
-- Bingo, plus presenting the guest photos and the couple's photos & videos on
-- the big screen. Guests no longer see a slideshow button.
-- Same rules as before: 10 wrong codes in 15 minutes pause the code for 15
-- minutes, a session lasts a day, and changing the code signs everyone out.

-- Public: type the code. Returns {ok, token} or {ok:false, reason: wrong | locked | off, left?, minutes?}.
create or replace function public.host_code_login(p_pin text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  h public.raffle_host%rowtype;
  v_token text;
  v_count int;
begin
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

-- Public: is this browser a host (admin, host link or code session)? And is a host code set at all?
create or replace function public.host_check(p_token text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'host', public.raffle_host_allowed(p_token),
    'codeOn', exists (select 1 from public.raffle_host where id = 1 and pin is not null));
$$;

revoke all on function public.host_code_login(text) from public;
revoke all on function public.host_check(text) from public;
grant execute on function public.host_code_login(text) to anon, authenticated;
grant execute on function public.host_check(text) to anon, authenticated;
