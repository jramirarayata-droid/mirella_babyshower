-- 025: the host can choose how the prize wheel works from the website:
-- "First spin wins" or "Last one standing" (same setting as Admin → Raffle).

create or replace function public.raffle_host_set_mode(p_token text, p_mode text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.raffle_host_allowed(p_token) then
    raise exception 'NOT_HOST' using errcode = '42501';
  end if;
  if not public.raffle_is_visible() then
    raise exception 'RAFFLE_HIDDEN' using errcode = '22023';
  end if;
  if p_mode not in ('first', 'last') then
    raise exception 'BAD_MODE' using errcode = '22023';
  end if;
  update public.admin_preferences
    set value = value || jsonb_build_object('drawMode', p_mode), updated_at = now()
    where key = 'raffle';
end;
$$;

revoke all on function public.raffle_host_set_mode(text, text) from public;
grant execute on function public.raffle_host_set_mode(text, text) to anon, authenticated;
