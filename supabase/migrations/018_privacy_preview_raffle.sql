-- 018: privacy options, the Messenger preview image, and the raffle wheel.
--
-- All settings live in admin_preferences (admin-only). Guests and the website
-- read only what they need through these functions:
--
--   public_display_prefs() → what the virtual card shows (Good to know picks,
--                            what stays hidden until a guest confirms), what the
--                            website keeps private, the link-preview image, and
--                            whether the raffle page is open.
--   invitation_card(id)    → position + attendance for the card on the RSVP page.
--   raffle_wheel()         → names for the public raffle page, masked on the
--                            server until the wedding date (or as set); nothing
--                            at all when the raffle page is switched off.
--   raffle_pool()          → admin only: every name that could be on the wheel.

-- Winners drawn by the host.
create table if not exists public.raffle_draws (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 150),
  prize text check (prize is null or length(prize) <= 150),
  drawn_at timestamptz not null default now()
);

alter table public.raffle_draws enable row level security;

drop policy if exists "Admins manage raffle draws" on public.raffle_draws;
create policy "Admins manage raffle draws" on public.raffle_draws for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.raffle_draws from anon;
grant select, insert, delete on public.raffle_draws to authenticated;

-- "Rina Gaspar" → "R*** G*****" (first letter of each word).
create or replace function public.mask_guest_name(n text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(left(w, 1) || repeat('*', greatest(least(length(w) - 1, 6), 2)), ' ' order by ord), '')
  from regexp_split_to_table(btrim(coalesce(n, '')), '\s+') with ordinality as t(w, ord)
  where w <> '';
$$;

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
      (select value from public.admin_preferences where key = 'raffle') as raffle
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
      else false end)
  from arr;
$$;

create or replace function public.invitation_card(p_invitation_id uuid)
returns table (position_mode text, position_label text, position_member_id text, attendance_status text)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(i.position_mode, 'auto')::text,
         i.position_label::text,
         (select l.member_id::text from public.entourage_links l
           where l.invitation_id = i.id and l.guest_id is null
           order by l.created_at limit 1),
         (select r.attendance_status::text from public.rsvp_responses r where r.invitation_id = i.id limit 1)
  from public.invitations i
  where i.id = p_invitation_id and i.is_active;
$$;

-- Everyone who could be on the wheel: invitees, included guests and approved extras.
create or replace function public.raffle_pool_rows()
returns table (name text, side text, attending boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select btrim(i.invitee_name)::text, coalesce(i.side, 'groom')::text,
         exists (select 1 from public.rsvp_responses r where r.invitation_id = i.id and r.attendance_status = 'attending')
  from public.invitations i
  where i.is_active and btrim(coalesce(i.invitee_name, '')) <> ''
  union all
  select btrim(g.guest_name)::text, coalesce(i.side, 'groom')::text,
         exists (select 1 from public.rsvp_responses r where r.invitation_id = i.id and r.attendance_status = 'attending')
  from public.additional_guests g
  join public.invitations i on i.id = g.invitation_id
  where i.is_active and g.status = 'approved' and btrim(coalesce(g.guest_name, '')) <> '';
$$;

revoke all on function public.raffle_pool_rows() from public, anon, authenticated;

create or replace function public.raffle_pool()
returns table (name text, side text, attending boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    return;
  end if;
  return query select r.name, r.side, r.attending from public.raffle_pool_rows() r;
end;
$$;

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
    and (not v_remove or lower(n) not in (select lower(btrim(d.name)) from public.raffle_draws d));

  return jsonb_build_object(
    'visible', true,
    'masked', v_masked,
    'names', to_jsonb(case when v_masked then array(select public.mask_guest_name(x) from unnest(v_names) x) else v_names end));
end;
$$;

revoke all on function public.public_display_prefs() from public;
revoke all on function public.invitation_card(uuid) from public;
revoke all on function public.raffle_pool() from public;
revoke all on function public.raffle_wheel() from public;
grant execute on function public.public_display_prefs() to anon, authenticated;
grant execute on function public.invitation_card(uuid) to anon, authenticated;
grant execute on function public.raffle_pool() to authenticated;
grant execute on function public.raffle_wheel() to anon, authenticated;
grant execute on function public.mask_guest_name(text) to anon, authenticated;
