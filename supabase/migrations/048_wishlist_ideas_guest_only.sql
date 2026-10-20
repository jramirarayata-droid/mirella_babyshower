-- =============================================================================
--  048 — Wishlist "ideas" and guest-only wishlist / What to Wear (needs 046)
--
--  * Wishlist entries now have a kind:
--      gift — something to bring; guests tap "I'll bring this" (as before)
--      idea — inspiration only: a photo, a title and a caption. Nobody claims it.
--  * Website Settings → Privacy gets two more switches (per shower):
--      hideWishlist — the gift wishlist is only for guests who RSVP'd "attending"
--      hideAttire   — What to Wear (outfit photos) is only for those guests
--    The database enforces it: the wishlist and the outfit photos are only
--    sent to a guest pass whose invitation has an "attending" reply.
--  * The original shower (mirella) gets both switches on; other showers keep
--    their current behaviour until their hosts switch them on.
--
--  Safe to run twice. Adds a column and functions; changes one read policy.
-- =============================================================================

begin;

-- ------------------------------------------------------------------ 1. kind
alter table public.registry_items add column if not exists kind text not null default 'gift';
alter table public.registry_items drop constraint if exists registry_items_kind_valid;
alter table public.registry_items add constraint registry_items_kind_valid check (kind in ('gift', 'idea'));

-- ------------------------------------------------------------------ 2. helpers
-- Is this part kept for attending guests only? ('wishlist' or 'attire')
create or replace function public.guest_only(p_what text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case p_what
      when 'wishlist' then (value->>'hideWishlist')::boolean
      when 'attire' then (value->>'hideAttire')::boolean
    end
    from public.admin_preferences where key = 'website_privacy'
  ), false);
$$;

-- Does this guest pass belong to an invitation that said "attending"?
create or replace function public.shower_attending(p_token text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.shower_person(p_token) p
    join public.rsvp_responses r on r.invitation_id = p.invitation_id
    where r.attendance_status = 'attending'
  );
$$;

-- What this visitor may see: { wishlistPrivate, attirePrivate, attending }.
create or replace function public.guest_access(p_token text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'wishlistPrivate', public.guest_only('wishlist'),
    'attirePrivate', public.guest_only('attire'),
    'attending', coalesce(public.shower_attending(p_token), false) or public.is_admin());
$$;

-- ------------------------------------------------------------------ 3. wishlist
create or replace function public.registry_list(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb := public.registry_cfg();
  p record;
begin
  if not public.registry_visible() and not public.is_admin() then
    return jsonb_build_object('visible', false, 'items', '[]'::jsonb);
  end if;
  -- Kept for attending guests: nothing but the title until they RSVP "attending".
  if public.guest_only('wishlist') and not public.is_admin() and not public.shower_attending(p_token) then
    return jsonb_build_object(
      'visible', true, 'private', true,
      'title', coalesce(nullif(btrim(c->>'title'), ''), 'Gift Wishlist'),
      'intro', '', 'me', (select s.name from public.shower_person(p_token) s), 'items', '[]'::jsonb);
  end if;
  select * into p from public.shower_person(p_token);
  return jsonb_build_object(
    'visible', true,
    'private', false,
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
      from public.registry_items r where r.is_visible), '[]'::jsonb));
end;
$$;

-- "I'll bring this": gifts only, and only for attending guests when the wishlist is private.
create or replace function public.registry_claim(p_token text, p_item uuid, p_qty int default 1)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  p record;
  it public.registry_items%rowtype;
  v_taken int;
  v_qty int := greatest(1, least(99, coalesce(p_qty, 1)));
begin
  if not public.registry_visible() then
    return jsonb_build_object('ok', false, 'reason', 'closed');
  end if;
  select * into p from public.shower_person(p_token);
  if p.invitation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'who');
  end if;
  if public.guest_only('wishlist') and not public.shower_attending(p_token) then
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

-- ------------------------------------------------------------------ 4. What to Wear
-- Outfit photos for the website (all of them when public; attending guests only when private).
create or replace function public.attire_list(p_token text default null)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'private', public.guest_only('attire'),
    'allowed', not public.guest_only('attire') or public.is_admin() or public.shower_attending(p_token),
    'items', case when not public.guest_only('attire') or public.is_admin() or public.shower_attending(p_token) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'gender', o.gender, 'image_url', o.image_url, 'caption', o.caption, 'label', o.label,
        'sort_order', o.sort_order, 'is_visible', o.is_visible)
        order by o.gender, o.sort_order, o.created_at)
      from public.outfit_images o where o.is_visible), '[]'::jsonb) else '[]'::jsonb end);
$$;

-- Visitors can no longer read the outfit table directly when What to Wear is private.
drop policy if exists "Public can view visible outfit images" on public.outfit_images;
create policy "Public can view visible outfit images"
  on public.outfit_images for select to anon, authenticated
  using (is_visible and not public.guest_only('attire'));

-- ------------------------------------------------------------------ 5. rights & owners
revoke all on function public.guest_only(text) from public;
revoke all on function public.shower_attending(text) from public, anon, authenticated;
revoke all on function public.guest_access(text) from public;
revoke all on function public.attire_list(text) from public;
grant execute on function public.guest_only(text) to anon, authenticated;
grant execute on function public.guest_access(text) to anon, authenticated;
grant execute on function public.attire_list(text) to anon, authenticated;
grant execute on function public.registry_list(text) to anon, authenticated;
grant execute on function public.registry_claim(text, uuid, int) to anon, authenticated;

-- Like every other database function: limited to the current shower.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'tenant_fn') then
    alter function public.guest_only(text) owner to tenant_fn;
    alter function public.shower_attending(text) owner to tenant_fn;
    alter function public.guest_access(text) owner to tenant_fn;
    alter function public.attire_list(text) owner to tenant_fn;
    alter function public.registry_list(text) owner to tenant_fn;
    alter function public.registry_claim(text, uuid, int) owner to tenant_fn;
    grant execute on function public.shower_attending(text) to tenant_fn;
  end if;
end $$;

-- ------------------------------------------------------------------ 6. the original shower
-- Wishlist and What to Wear for attending guests only (mirella only).
do $$
declare
  v_space uuid;
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'spaces') then
    select id into v_space from public.spaces where slug = 'mirella';
    if v_space is not null then
      insert into public.admin_preferences (space_id, key, value)
      values (v_space, 'website_privacy', '{"hideWishlist": true, "hideAttire": true}'::jsonb)
      on conflict (space_id, key) do update
        set value = public.admin_preferences.value || '{"hideWishlist": true, "hideAttire": true}'::jsonb;
    end if;
  end if;
end $$;

commit;
