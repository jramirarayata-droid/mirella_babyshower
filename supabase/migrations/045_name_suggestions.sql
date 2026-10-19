-- =============================================================================
--  045 — Name ideas from guests
--  Run after 044. Safe to run twice. Only adds a table and functions.
--
--  * name_suggestions: a guest's name idea for the baby (for a girl, a boy or
--    either) with an optional note; admin only. Guests add and remove their
--    own through the functions below (up to perGuest, default 3).
--  * admin_preferences 'names' = {mode, from, approval: instant | approve,
--    perGuest}. With "approve", ideas wait until an admin shows them.
--  * name_ideas_list(): the shown ideas, grouped (the same name suggested
--    twice counts twice), with who suggested them as "Rina G.".
-- =============================================================================

create table if not exists public.name_suggestions (
  id            uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.invitations(id) on delete cascade,
  guest_id      uuid references public.additional_guests(id) on delete cascade,
  by_name       text not null,
  suggestion    varchar(40) not null check (char_length(btrim(suggestion)) >= 1),
  for_gender    text not null default 'any' check (for_gender in ('girl', 'boy', 'any')),
  note          varchar(200),
  status        text not null default 'visible' check (status in ('visible', 'pending', 'hidden')),
  created_at    timestamptz not null default now()
);
create index if not exists name_suggestions_person_idx on public.name_suggestions (invitation_id, guest_id);
create index if not exists name_suggestions_status_idx on public.name_suggestions (status, created_at desc);

alter table public.name_suggestions enable row level security;
drop policy if exists "Admins manage name ideas" on public.name_suggestions;
create policy "Admins manage name ideas" on public.name_suggestions for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.name_suggestions from anon;
grant select, insert, update, delete on public.name_suggestions to authenticated;

create or replace function public.names_cfg()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce((select value from public.admin_preferences where key = 'names'), '{}'::jsonb);
$$;
revoke all on function public.names_cfg() from public, anon, authenticated;

create or replace function public.names_visible()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.timing_on(c->>'mode', c->>'from') from (select public.names_cfg() c) x;
$$;
revoke all on function public.names_visible() from public, anon, authenticated;

-- Public: is it on, how it works, and this guest's own ideas.
create or replace function public.name_ideas_info(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb := public.names_cfg();
  p record;
begin
  select * into p from public.shower_person(p_token);
  return jsonb_build_object(
    'visible', public.names_visible(),
    'approval', case when c->>'approval' = 'approve' then 'approve' else 'instant' end,
    'perGuest', greatest(1, least(10, coalesce((c->>'perGuest')::int, 3))),
    'me', p.name,
    'mine', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'suggestion', s.suggestion, 'forGender', s.for_gender, 'note', s.note, 'status', s.status) order by s.created_at)
      from public.name_suggestions s
      where p.invitation_id is not null and s.invitation_id = p.invitation_id and s.guest_id is not distinct from p.guest_id and s.status <> 'hidden'), '[]'::jsonb));
end;
$$;

-- Public: add a name idea.
create or replace function public.name_idea_add(p_token text, p_suggestion text, p_for text, p_note text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  c jsonb := public.names_cfg();
  p record;
  v_name text := regexp_replace(btrim(coalesce(p_suggestion, '')), '\s+', ' ', 'g');
  v_note text := nullif(regexp_replace(btrim(coalesce(p_note, '')), '\s+', ' ', 'g'), '');
  v_for text := case when p_for in ('girl', 'boy') then p_for else 'any' end;
  v_limit int := greatest(1, least(10, coalesce((c->>'perGuest')::int, 3)));
begin
  if not public.names_visible() then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  select * into p from public.shower_person(p_token);
  if p.invitation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'who');
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 40 or (v_note is not null and char_length(v_note) > 200) then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if (select count(*) from public.name_suggestions s where s.invitation_id = p.invitation_id and s.guest_id is not distinct from p.guest_id) >= v_limit then
    return jsonb_build_object('ok', false, 'reason', 'limit', 'limit', v_limit);
  end if;
  if exists (select 1 from public.name_suggestions s where s.invitation_id = p.invitation_id and s.guest_id is not distinct from p.guest_id
             and public.normalize_name(s.suggestion) = public.normalize_name(v_name)) then
    return jsonb_build_object('ok', false, 'reason', 'duplicate');
  end if;
  insert into public.name_suggestions (invitation_id, guest_id, by_name, suggestion, for_gender, note, status)
  values (p.invitation_id, p.guest_id, p.name, v_name, v_for, v_note, case when c->>'approval' = 'approve' then 'pending' else 'visible' end);
  return jsonb_build_object('ok', true, 'pending', c->>'approval' = 'approve');
end;
$$;

-- Public: remove one of my own ideas.
create or replace function public.name_idea_remove(p_token text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  p record;
begin
  select * into p from public.shower_person(p_token);
  if p.invitation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'who');
  end if;
  delete from public.name_suggestions s where s.id = p_id and s.invitation_id = p.invitation_id and s.guest_id is not distinct from p.guest_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Public: the shown ideas, most suggested first (website and big screen).
create or replace function public.name_ideas_list()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when not public.names_visible() and not public.is_admin() then '[]'::jsonb else coalesce((
    select jsonb_agg(q.g order by q.n desc, q.name)
    from (
      select a.n, a.name, jsonb_build_object(
        'name', a.name,
        'forGender', a.for_gender,
        'count', a.n,
        'by', (select jsonb_agg(public.short_guest_name(x.by_name)) from (select t.by_name from public.name_suggestions t
               where t.status = 'visible' and public.normalize_name(t.suggestion) = a.k order by t.created_at limit 6) x),
        'notes', (select jsonb_agg(x.note) from (select t.note from public.name_suggestions t
               where t.status = 'visible' and t.note is not null and public.normalize_name(t.suggestion) = a.k order by t.created_at limit 3) x)) as g
      from (
        -- one row per name (same name typed differently counts once)
        select public.normalize_name(s.suggestion) as k, min(s.suggestion) as name, count(*)::int as n,
               case when count(distinct s.for_gender) = 1 then min(s.for_gender) else 'any' end as for_gender
        from public.name_suggestions s
        where s.status = 'visible'
        group by public.normalize_name(s.suggestion)
        order by count(*) desc
        limit 200) a) q), '[]'::jsonb) end;
$$;

revoke all on function public.name_ideas_info(text) from public;
revoke all on function public.name_idea_add(text, text, text, text) from public;
revoke all on function public.name_idea_remove(text, uuid) from public;
revoke all on function public.name_ideas_list() from public;
grant execute on function public.name_ideas_info(text) to anon, authenticated;
grant execute on function public.name_idea_add(text, text, text, text) to anon, authenticated;
grant execute on function public.name_idea_remove(text, uuid) to anon, authenticated;
grant execute on function public.name_ideas_list() to anon, authenticated;

insert into public.admin_preferences (key, value)
values ('names', '{"mode": "visible", "approval": "instant", "perGuest": 3}'::jsonb)
on conflict (key) do nothing;
