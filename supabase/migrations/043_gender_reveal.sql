-- =============================================================================
--  043 — Gender reveal
--  Run after 042. Safe to run twice. Only adds a table and functions.
--
--  * gender_reveal (one row, admin only): the answer, the reveal time and the
--    wording. Nobody but an admin can read the answer before the reveal time:
--    public_gender_reveal() only includes it once now() >= reveal_at.
--  * gender_reveal_now(host token): the host (or an admin) can reveal it on
--    the spot from the big screen — it sets reveal_at to now.
-- =============================================================================

create table if not exists public.gender_reveal (
  id          integer primary key default 1 check (id = 1),
  enabled     boolean not null default false,
  answer      text check (answer is null or answer in ('girl', 'boy', 'twin_girls', 'twin_boys', 'twins')),
  reveal_at   timestamptz,
  title       varchar(80) not null default 'Boy or Girl?',
  message     varchar(300) not null default 'We can''t wait to share our little secret with you!',
  updated_at  timestamptz not null default now()
);
insert into public.gender_reveal (id) values (1) on conflict (id) do nothing;
drop trigger if exists gender_reveal_updated_at on public.gender_reveal;
create trigger gender_reveal_updated_at before update on public.gender_reveal for each row execute function public.set_updated_at();

alter table public.gender_reveal enable row level security;
drop policy if exists "Admins manage the gender reveal" on public.gender_reveal;
create policy "Admins manage the gender reveal" on public.gender_reveal for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.gender_reveal from anon;
grant select, insert, update on public.gender_reveal to authenticated;

-- Has the reveal happened? (internal)
create or replace function public.gender_revealed()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select g.enabled and g.answer is not null and g.reveal_at is not null and now() >= g.reveal_at from public.gender_reveal g where g.id = 1), false);
$$;
revoke all on function public.gender_revealed() from public, anon, authenticated;

-- The revealed answer, or null before the reveal (internal).
create or replace function public.gender_answer()
returns text language sql stable security definer set search_path = ''
as $$
  select case when public.gender_revealed() then (select answer from public.gender_reveal where id = 1) end;
$$;
revoke all on function public.gender_answer() from public, anon, authenticated;

-- Public: what the website and the big screen may show. The answer is only
-- included once the reveal time has passed.
create or replace function public.public_gender_reveal()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'enabled', g.enabled and g.answer is not null,
    'revealAt', g.reveal_at,
    'revealed', public.gender_revealed(),
    'answer', public.gender_answer(),
    'title', g.title,
    'message', g.message,
    'now', now())
  from public.gender_reveal g where g.id = 1;
$$;

-- Host (or admin): reveal it now, from the big screen.
create or replace function public.gender_reveal_now(p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not public.raffle_host_allowed(p_token) then
    return jsonb_build_object('ok', false, 'reason', 'host');
  end if;
  update public.gender_reveal set reveal_at = now() where id = 1 and enabled and answer is not null and (reveal_at is null or reveal_at > now());
  return jsonb_build_object('ok', true, 'reveal', public.public_gender_reveal());
end;
$$;

revoke all on function public.public_gender_reveal() from public;
revoke all on function public.gender_reveal_now(text) from public;
grant execute on function public.public_gender_reveal() to anon, authenticated;
grant execute on function public.gender_reveal_now(text) to anon, authenticated;
