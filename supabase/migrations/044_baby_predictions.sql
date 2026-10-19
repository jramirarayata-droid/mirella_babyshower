-- =============================================================================
--  044 — Baby predictions game
--  Run after 043. Safe to run twice. Only adds a table and functions.
--
--  * baby_predictions: one guess per guest (due date, weight, boy or girl),
--    admin only; guests change their own guess through prediction_save().
--  * admin_preferences 'predictions' = {mode, from, closeAt, birthDate,
--    weightKg}: mode hidden | visible | scheduled | reveal. Guessing closes at
--    closeAt, or at the gender reveal when that is set and closeAt isn't.
--  * predictions_board(): the tallies for the website and the big screen and,
--    once the real answers are known (the reveal; the birth date and weight
--    typed in by an admin), the closest guesses. Names are shortened ("Rina G.").
-- =============================================================================

create table if not exists public.baby_predictions (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  guest_id      uuid references public.additional_guests(id) on delete cascade,
  name          text not null,
  due_date      date,
  weight_kg     numeric(4, 2) check (weight_kg is null or weight_kg between 0.5 and 7),
  gender        text check (gender is null or gender in ('girl', 'boy')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint baby_predictions_something check (due_date is not null or weight_kg is not null or gender is not null)
);
create unique index if not exists baby_predictions_person_uniq
  on public.baby_predictions (invitation_id, coalesce(guest_id, '00000000-0000-0000-0000-000000000000'::uuid));
drop trigger if exists baby_predictions_updated_at on public.baby_predictions;
create trigger baby_predictions_updated_at before update on public.baby_predictions for each row execute function public.set_updated_at();

alter table public.baby_predictions enable row level security;
drop policy if exists "Admins manage predictions" on public.baby_predictions;
create policy "Admins manage predictions" on public.baby_predictions for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.baby_predictions from anon;
grant select, insert, update, delete on public.baby_predictions to authenticated;

create or replace function public.predictions_cfg()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce((select value from public.admin_preferences where key = 'predictions'), '{}'::jsonb);
$$;
revoke all on function public.predictions_cfg() from public, anon, authenticated;

-- When guessing closes (null = it stays open).
create or replace function public.predictions_close_at()
returns timestamptz language sql stable security definer set search_path = ''
as $$
  select coalesce(
    nullif(public.predictions_cfg()->>'closeAt', '')::timestamptz,
    (select g.reveal_at from public.gender_reveal g where g.id = 1 and g.enabled and g.answer is not null));
$$;
revoke all on function public.predictions_close_at() from public, anon, authenticated;

create or replace function public.predictions_visible()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.timing_on(c->>'mode', c->>'from') from (select public.predictions_cfg() c) x;
$$;
revoke all on function public.predictions_visible() from public, anon, authenticated;

create or replace function public.predictions_open()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.predictions_visible() and (public.predictions_close_at() is null or now() < public.predictions_close_at());
$$;
revoke all on function public.predictions_open() from public, anon, authenticated;

-- Public: is the game on, is it still open, and this guest's own guess.
create or replace function public.predictions_info(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  p record;
  mine jsonb;
begin
  select * into p from public.shower_person(p_token);
  if p.invitation_id is not null then
    select jsonb_build_object('dueDate', b.due_date, 'weightKg', b.weight_kg, 'gender', b.gender)
    into mine from public.baby_predictions b
    where b.invitation_id = p.invitation_id and b.guest_id is not distinct from p.guest_id;
  end if;
  return jsonb_build_object(
    'visible', public.predictions_visible(),
    'open', public.predictions_open(),
    'closeAt', public.predictions_close_at(),
    'count', (select count(*) from public.baby_predictions),
    'me', p.name,
    'mine', mine);
end;
$$;

-- Public: save (or change) this guest's guess while the game is open.
create or replace function public.prediction_save(p_token text, p_due date, p_weight numeric, p_gender text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  p record;
  v_gender text := nullif(lower(btrim(coalesce(p_gender, ''))), '');
begin
  if not public.predictions_open() then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  select * into p from public.shower_person(p_token);
  if p.invitation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'who');
  end if;
  if v_gender is not null and v_gender not in ('girl', 'boy') then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_weight is not null and (p_weight < 0.5 or p_weight > 7) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_due is not null and (p_due < current_date - 120 or p_due > current_date + 400) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if p_due is null and p_weight is null and v_gender is null then
    return jsonb_build_object('ok', false, 'reason', 'empty');
  end if;
  insert into public.baby_predictions as b (invitation_id, guest_id, name, due_date, weight_kg, gender)
  values (p.invitation_id, p.guest_id, p.name, p_due, round(p_weight, 2), v_gender)
  on conflict (invitation_id, coalesce(guest_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set due_date = excluded.due_date, weight_kg = excluded.weight_kg, gender = excluded.gender, name = excluded.name;
  return jsonb_build_object('ok', true);
end;
$$;

-- Public: the tallies and, once known, the closest guesses (website and big screen).
create or replace function public.predictions_board()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb := public.predictions_cfg();
  v_birth date := nullif(c->>'birthDate', '')::date;
  v_weight numeric := nullif(c->>'weightKg', '')::numeric;
  v_answer text := public.gender_answer();
  v_gender text := case when v_answer in ('girl', 'twin_girls') then 'girl' when v_answer in ('boy', 'twin_boys') then 'boy' end;
begin
  if not public.predictions_visible() and not public.is_admin() then
    return jsonb_build_object('visible', false);
  end if;
  return jsonb_build_object(
    'visible', true,
    'open', public.predictions_open(),
    'count', (select count(*) from public.baby_predictions),
    'girl', (select count(*) from public.baby_predictions where gender = 'girl'),
    'boy', (select count(*) from public.baby_predictions where gender = 'boy'),
    'avgWeightKg', (select round(avg(weight_kg), 2) from public.baby_predictions),
    'dueDates', coalesce((
      select jsonb_agg(jsonb_build_object('date', d, 'n', n) order by d)
      from (select due_date d, count(*) n from public.baby_predictions where due_date is not null group by due_date) x), '[]'::jsonb),
    'actual', jsonb_build_object('birthDate', v_birth, 'weightKg', v_weight, 'gender', v_gender),
    'closestDate', case when v_birth is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('name', public.short_guest_name(name), 'guess', due_date, 'off', abs(due_date - v_birth)) order by abs(due_date - v_birth), created_at)
      from (select * from public.baby_predictions where due_date is not null order by abs(due_date - v_birth), created_at limit 3) x), '[]'::jsonb) end,
    'closestWeight', case when v_weight is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('name', public.short_guest_name(name), 'guess', weight_kg, 'off', abs(weight_kg - v_weight)) order by abs(weight_kg - v_weight), created_at)
      from (select * from public.baby_predictions where weight_kg is not null order by abs(weight_kg - v_weight), created_at limit 3) x), '[]'::jsonb) end,
    'genderRight', case when v_gender is null then '[]'::jsonb else coalesce((
      select jsonb_agg(public.short_guest_name(name) order by created_at)
      from (select * from public.baby_predictions where gender = v_gender order by created_at limit 40) x), '[]'::jsonb) end);
end;
$$;

revoke all on function public.predictions_info(text) from public;
revoke all on function public.prediction_save(text, date, numeric, text) from public;
revoke all on function public.predictions_board() from public;
grant execute on function public.predictions_info(text) to anon, authenticated;
grant execute on function public.prediction_save(text, date, numeric, text) to anon, authenticated;
grant execute on function public.predictions_board() to anon, authenticated;

insert into public.admin_preferences (key, value)
values ('predictions', '{"mode": "visible"}'::jsonb)
on conflict (key) do nothing;
