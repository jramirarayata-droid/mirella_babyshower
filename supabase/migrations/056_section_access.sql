-- =============================================================================
--  056 — "Who sees it" for each section (needs 055)
--
--  One choice per section (Gift Registry, What to Wear, Gender Reveal, Baby
--  Predictions, Name Ideas), stored in admin_preferences 'section_access' as
--  { "<section>": "website" | "website_invite" | "invite" | "attending" }:
--    website         — anyone with the website link (default)
--    website_invite  — the same, plus a link on each guest's invitation page
--                      and RSVP confirmation
--    invite          — invited guests only (they open it from their invitation
--                      or by typing their name); not on the public website
--    attending       — only guests who RSVP'd "attending"
--  "Hidden" stays where it always was (each section's own on/off switch).
--  The database checks this for every guest request, so a section can't be
--  opened by someone it isn't meant for.
--
--  Existing showers keep what they had: until a choice is saved, a section
--  kept for attending guests (Website Settings → Privacy) stays "attending",
--  everything else "website". No data is changed.
--
--  Rollback (if ever needed): run 048, 050 and 055 again for the wishlist,
--  ideas and What to Wear functions, and 043/044/045 for reveal, predictions
--  and name ideas; then drop function public.section_open(text, text),
--  public.section_audience(text), public.guest_sections(text), public.gender_reveal_json().
--
--  Safe to run twice. Run ONLY in the baby shower project (it stops otherwise).
-- =============================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'spaces') then
    raise exception 'STOP: this is not the baby shower project. Run this only in Mir and Ella Babyshower.';
  end if;
end $$;

-- ------------------------------------------------------------------ 1. the rule
create or replace function public.section_audience(p_what text)
returns text language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select case when a.value->>p_what in ('website', 'website_invite', 'invite', 'attending') then a.value->>p_what end
       from public.admin_preferences a where a.key = 'section_access'),
    -- Before a choice is saved: what Website Settings → Privacy said.
    case when coalesce((select (w.value->>case p_what when 'registry' then 'hideWishlist' when 'attire' then 'hideAttire' else 'none' end)::boolean
                        from public.admin_preferences w where w.key = 'website_privacy'), false)
         then 'attending' else 'website' end);
$$;

-- May the visitor with this guest pass see the section?
create or replace function public.section_open(p_what text, p_token text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case public.section_audience(p_what)
    when 'invite' then exists (select 1 from public.shower_person(p_token))
    when 'attending' then coalesce(public.shower_attending(p_token), false)
    else true end;
$$;

-- Kept for older callers: "not for everyone" (invited or attending guests only).
create or replace function public.guest_only(p_what text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.section_audience(case when p_what in ('wishlist', 'ideas') then 'registry' else p_what end) in ('invite', 'attending');
$$;

-- For the invitation page, the RSVP confirmation and the menu: per section,
-- who it's for, whether it's switched on, and whether this visitor may open it.
create or replace function public.guest_sections(p_token text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'registry', jsonb_build_object('who', public.section_audience('registry'), 'on', public.registry_visible(), 'open', public.section_open('registry', p_token),
                                   'tab', coalesce(public.registry_cfg()->>'active', 'list')),
    'attire', jsonb_build_object('who', public.section_audience('attire'), 'on', coalesce((select w.outfit_section_visible from public.wedding_settings w limit 1), false), 'open', public.section_open('attire', p_token)),
    'reveal', jsonb_build_object('who', public.section_audience('reveal'), 'on', coalesce((select g.enabled and g.answer is not null from public.gender_reveal g where g.id = 1), false), 'open', public.section_open('reveal', p_token)),
    'predictions', jsonb_build_object('who', public.section_audience('predictions'), 'on', public.predictions_visible(), 'open', public.section_open('predictions', p_token)),
    'names', jsonb_build_object('who', public.section_audience('names'), 'on', public.names_visible(), 'open', public.section_open('names', p_token)));
$$;

-- ------------------------------------------------------------------ 2. Gift Registry (both tabs)
create or replace function public.registry_list(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb := public.registry_cfg();
  p record;
  -- What this visitor would see as a guest (the home page and menu follow this, even for admins).
  -- Which tab is live on the website: the gift list (default) or the gift ideas photos.
  v_ideas boolean := coalesce(c->>'active', 'list') = 'ideas';
  v_guest boolean := not v_ideas and public.registry_visible() and public.section_open('registry', p_token);
begin
  if (v_ideas or not public.registry_visible()) and not public.is_admin() then
    return jsonb_build_object('visible', false, 'guestVisible', false, 'ideasLive', v_ideas and public.registry_visible(), 'items', '[]'::jsonb);
  end if;
  -- Kept for attending guests: nothing but the title until they RSVP "attending".
  if not public.section_open('registry', p_token) and not public.is_admin() then
    return jsonb_build_object(
      'visible', true, 'private', true, 'guestVisible', v_guest,
      'title', coalesce(nullif(btrim(c->>'title'), ''), 'Gift Wishlist'),
      'intro', '', 'me', (select s.name from public.shower_person(p_token) s), 'items', '[]'::jsonb);
  end if;
  select * into p from public.shower_person(p_token);
  return jsonb_build_object(
    'visible', true,
    'private', false,
    'guestVisible', v_guest,
    'title', coalesce(nullif(btrim(c->>'title'), ''), 'Gift Wishlist'),
    'intro', coalesce(c->>'intro', ''),
    'me', p.name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'kind', r.kind, 'title', r.title, 'note', r.note, 'link', r.link, 'image', r.image_url, 'price', r.price_hint,
        'quantity', r.quantity,
        'claimed', coalesce((select sum(k.qty) from public.registry_claims k where k.item_id = r.id), 0),
        'mine', coalesce((select sum(k.qty) from public.registry_claims k
                          where k.item_id = r.id and p.invitation_id is not null and k.invitation_id = p.invitation_id
                            and k.guest_id is not distinct from p.guest_id), 0))
        order by r.sort_order, r.created_at)
      from public.registry_items r where r.is_visible and r.kind = 'gift'), '[]'::jsonb));
end;
$$;
create or replace function public.registry_claim(p_token text, p_item uuid, p_qty int default 1)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  p record;
  it public.registry_items%rowtype;
  v_taken int;
  v_qty int := greatest(1, least(99, coalesce(p_qty, 1)));
begin
  if not public.registry_visible() or coalesce(public.registry_cfg()->>'active', 'list') = 'ideas' then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  select * into p from public.shower_person(p_token);
  if p.invitation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'who');
  end if;
  if not public.section_open('registry', p_token) then
    return jsonb_build_object('ok', false, 'reason', 'private');
  end if;
  select * into it from public.registry_items where id = p_item and is_visible and kind = 'gift' for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'gone');
  end if;
  select coalesce(sum(qty), 0) into v_taken from public.registry_claims where item_id = it.id;
  if v_taken + v_qty > it.quantity then
    return jsonb_build_object('ok', false, 'reason', 'taken', 'left', greatest(0, it.quantity - v_taken));
  end if;
  insert into public.registry_claims as k (item_id, invitation_id, guest_id, name, qty)
  values (it.id, p.invitation_id, p.guest_id, p.name, v_qty)
  on conflict (item_id, invitation_id, coalesce(guest_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set qty = k.qty + excluded.qty, name = excluded.name;
  return jsonb_build_object('ok', true, 'left', it.quantity - v_taken - v_qty);
end;
$$;
create or replace function public.gift_ideas_list(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  r_cfg jsonb := public.registry_cfg();
  c jsonb := coalesce((select value from public.admin_preferences where key = 'gift_ideas'), '{}'::jsonb);
  v_live boolean := coalesce(r_cfg->>'active', 'list') = 'ideas' and public.registry_visible();
  v_title text := coalesce(nullif(btrim(c->>'title'), ''), 'Gift Ideas');
  v_layout text := coalesce(nullif(c->>'layout', ''), 'wishboard');
begin
  if not v_live then
    return jsonb_build_object('visible', false, 'listLive', coalesce(r_cfg->>'active', 'list') <> 'ideas' and public.registry_visible(), 'items', '[]'::jsonb);
  end if;
  if not public.section_open('registry', p_token) then
    return jsonb_build_object('visible', true, 'private', true, 'title', v_title, 'intro', '', 'layout', v_layout, 'items', '[]'::jsonb);
  end if;
  return jsonb_build_object(
    'visible', true,
    'private', false,
    'title', v_title,
    'intro', coalesce(c->>'intro', ''),
    'layout', v_layout,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'note', r.note, 'link', r.link, 'image', r.image_url) order by r.sort_order, r.created_at)
      from public.registry_items r where r.is_visible and r.kind = 'idea' and coalesce(r.image_url, '') <> ''), '[]'::jsonb));
end;
$$;
-- ------------------------------------------------------------------ 3. What to Wear
create or replace function public.attire_list(p_token text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'private', public.section_audience('attire') in ('invite', 'attending'),
    'allowed', public.section_open('attire', p_token) or public.is_admin(),
    'items', case when public.section_open('attire', p_token) or public.is_admin() then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'gender', o.gender, 'image_url', o.image_url, 'caption', o.caption, 'label', o.label,
        'sort_order', o.sort_order, 'is_visible', o.is_visible)
        order by o.gender, o.sort_order, o.created_at)
      from public.outfit_images o where o.is_visible), '[]'::jsonb) else '[]'::jsonb end);
$$;
-- ------------------------------------------------------------------ 4. Baby Predictions
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
    'visible', public.predictions_visible() and public.section_open('predictions', p_token),
    'private', public.predictions_visible() and not public.section_open('predictions', p_token),
    'open', public.predictions_open() and public.section_open('predictions', p_token),
    'closeAt', public.predictions_close_at(),
    'count', (select count(*) from public.baby_predictions),
    'me', p.name,
    'mine', mine);
end;
$$;
drop function if exists public.predictions_board();
create or replace function public.predictions_board(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb := public.predictions_cfg();
  v_birth date := nullif(c->>'birthDate', '')::date;
  v_weight numeric := nullif(c->>'weightKg', '')::numeric;
  v_answer text := public.gender_answer();
  v_gender text := case when v_answer in ('girl', 'twin_girls') then 'girl' when v_answer in ('boy', 'twin_boys') then 'boy' end;
begin
  if not (public.predictions_visible() and public.section_open('predictions', p_token)) and not public.raffle_host_allowed(p_token) then
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
  if not public.section_open('predictions', p_token) then
    return jsonb_build_object('ok', false, 'reason', 'private');
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
-- ------------------------------------------------------------------ 5. Name Ideas
create or replace function public.name_ideas_info(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb := public.names_cfg();
  p record;
begin
  select * into p from public.shower_person(p_token);
  return jsonb_build_object(
    'visible', public.names_visible() and public.section_open('names', p_token),
    'private', public.names_visible() and not public.section_open('names', p_token),
    'approval', case when c->>'approval' = 'approve' then 'approve' else 'instant' end,
    'perGuest', greatest(1, least(10, coalesce((c->>'perGuest')::int, 3))),
    'me', p.name,
    'mine', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'suggestion', s.suggestion, 'forGender', s.for_gender, 'note', s.note, 'status', s.status) order by s.created_at)
      from public.name_suggestions s
      where p.invitation_id is not null and s.invitation_id = p.invitation_id and s.guest_id is not distinct from p.guest_id and s.status <> 'hidden'), '[]'::jsonb));
end;
$$;
drop function if exists public.name_ideas_list();
create or replace function public.name_ideas_list(p_token text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when not (public.names_visible() and public.section_open('names', p_token)) and not public.raffle_host_allowed(p_token) then '[]'::jsonb else coalesce((
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
  if not public.section_open('names', p_token) then
    return jsonb_build_object('ok', false, 'reason', 'private');
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
-- ------------------------------------------------------------------ 6. Gender Reveal
-- The reveal itself (for the host's "Reveal now" and for guests allowed to see it).
create or replace function public.gender_reveal_json()
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
drop function if exists public.public_gender_reveal();
create or replace function public.public_gender_reveal(p_token text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when public.section_open('reveal', p_token) or public.raffle_host_allowed(p_token)
    then public.gender_reveal_json()
    else jsonb_build_object('enabled', false, 'private', true, 'revealed', false, 'now', now()) end;
$$;
create or replace function public.gender_reveal_now(p_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if not public.raffle_host_allowed(p_token) then
    return jsonb_build_object('ok', false, 'reason', 'host');
  end if;
  update public.gender_reveal set reveal_at = now() where id = 1 and enabled and answer is not null and (reveal_at is null or reveal_at > now());
  return jsonb_build_object('ok', true, 'reveal', public.gender_reveal_json());
end;
$$;
-- ------------------------------------------------------------------ 7. access
revoke all on function public.section_audience(text) from public, anon, authenticated;
revoke all on function public.section_open(text, text) from public, anon, authenticated;
revoke all on function public.gender_reveal_json() from public, anon, authenticated;
grant execute on function public.guest_only(text) to anon, authenticated;
grant execute on function public.guest_sections(text) to anon, authenticated;
grant execute on function public.registry_list(text) to anon, authenticated;
grant execute on function public.registry_claim(text, uuid, int) to anon, authenticated;
grant execute on function public.gift_ideas_list(text) to anon, authenticated;
grant execute on function public.attire_list(text) to anon, authenticated;
grant execute on function public.predictions_info(text) to anon, authenticated;
grant execute on function public.predictions_board(text) to anon, authenticated;
grant execute on function public.prediction_save(text, date, numeric, text) to anon, authenticated;
grant execute on function public.name_ideas_info(text) to anon, authenticated;
grant execute on function public.name_ideas_list(text) to anon, authenticated;
grant execute on function public.name_idea_add(text, text, text, text) to anon, authenticated;
grant execute on function public.public_gender_reveal(text) to anon, authenticated;

-- Like every other database function: limited to the current shower.
do $$
declare
  f text;
begin
  if exists (select 1 from pg_roles where rolname = 'tenant_fn') then
    foreach f in array array[
      'section_audience(text)', 'section_open(text, text)', 'guest_only(text)', 'guest_sections(text)',
      'registry_list(text)', 'registry_claim(text, uuid, int)', 'gift_ideas_list(text)', 'attire_list(text)',
      'predictions_info(text)', 'predictions_board(text)', 'prediction_save(text, date, numeric, text)',
      'name_ideas_info(text)', 'name_ideas_list(text)', 'name_idea_add(text, text, text, text)',
      'gender_reveal_json()', 'public_gender_reveal(text)', 'gender_reveal_now(text)'] loop
      execute format('alter function public.%s owner to tenant_fn', f);
    end loop;
    grant execute on function public.section_audience(text) to tenant_fn;
    grant execute on function public.section_open(text, text) to tenant_fn;
    grant execute on function public.gender_reveal_json() to tenant_fn;
  end if;
end $$;

commit;
