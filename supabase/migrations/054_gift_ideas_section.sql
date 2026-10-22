-- =============================================================================
--  054 — Gift ideas get their own section (needs 048 and 050)
--
--  Ideas (photo + title + caption) used to sit at the bottom of the Gift
--  Wishlist page. They now have their own section on the home page, with:
--    - their own Show / Hide switch          (admin_preferences 'gift_ideas'.visible, default on)
--    - their own title, intro and gallery design (…title / intro / layout)
--    - their own "Who can see" setting       (website_privacy.hideIdeas;
--      until it is set it follows the wishlist's setting, as before)
--  The RSVP confirmation's "Just for you" links (wishlist, gift ideas, What to
--  Wear) can each be switched off (admin_preferences 'rsvp_extras').
--  The Gift Wishlist page now lists gifts only. Nothing is deleted or moved
--  in the data: the same idea items are simply shown in the new section.
--
--  Rollback (if ever needed): run 050_home_shows_guest_view.sql again (the
--  wishlist then lists ideas again) and 048's guest_only(); gift_ideas_list
--  can stay (unused) or be dropped.
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

-- ------------------------------------------------------------------ 1. who can see
-- Is this part kept for attending guests only? ('wishlist', 'attire' or 'ideas')
create or replace function public.guest_only(p_what text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case p_what
      when 'wishlist' then (value->>'hideWishlist')::boolean
      when 'attire' then (value->>'hideAttire')::boolean
      -- Ideas follow the wishlist until the customer chooses for them.
      when 'ideas' then coalesce((value->>'hideIdeas')::boolean, (value->>'hideWishlist')::boolean)
    end
    from public.admin_preferences where key = 'website_privacy'
  ), false);
$$;

-- ------------------------------------------------------------------ 2. the wishlist: gifts only
create or replace function public.registry_list(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb := public.registry_cfg();
  p record;
  -- What this visitor would see as a guest (the home page and menu follow this, even for admins).
  v_guest boolean := public.registry_visible() and (not public.guest_only('wishlist') or public.shower_attending(p_token));
begin
  if not public.registry_visible() and not public.is_admin() then
    return jsonb_build_object('visible', false, 'guestVisible', false, 'items', '[]'::jsonb);
  end if;
  -- Kept for attending guests: nothing but the title until they RSVP "attending".
  if public.guest_only('wishlist') and not public.is_admin() and not public.shower_attending(p_token) then
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

-- ------------------------------------------------------------------ 3. the ideas section
-- { visible, private, title, intro, layout, items: [{ id, title, note, link, image }] }
-- Like the home page, this is always the guest's view (admins included).
create or replace function public.gift_ideas_list(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb := coalesce((select value from public.admin_preferences where key = 'gift_ideas'), '{}'::jsonb);
  v_title text := coalesce(nullif(btrim(c->>'title'), ''), 'Gift Ideas');
  v_layout text := coalesce(nullif(c->>'layout', ''), 'cards');
begin
  if coalesce((c->>'visible')::boolean, true) is false then
    return jsonb_build_object('visible', false, 'items', '[]'::jsonb);
  end if;
  if public.guest_only('ideas') and not public.shower_attending(p_token) then
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

-- ------------------------------------------------------------------ 4. the RSVP confirmation
-- Which "Just for you" links the RSVP confirmation offers: { wishlist, ideas, attire }
-- (each true unless switched off). Only on/off switches — nothing private.
create or replace function public.rsvp_extras()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce((select value from public.admin_preferences where key = 'rsvp_extras'), '{}'::jsonb);
$$;

revoke all on function public.rsvp_extras() from public;
grant execute on function public.rsvp_extras() to anon, authenticated;
revoke all on function public.gift_ideas_list(text) from public;
grant execute on function public.guest_only(text) to anon, authenticated;
grant execute on function public.registry_list(text) to anon, authenticated;
grant execute on function public.gift_ideas_list(text) to anon, authenticated;

-- Like every other database function: limited to the current shower.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'tenant_fn') then
    alter function public.guest_only(text) owner to tenant_fn;
    alter function public.registry_list(text) owner to tenant_fn;
    alter function public.gift_ideas_list(text) owner to tenant_fn;
    alter function public.rsvp_extras() owner to tenant_fn;
  end if;
end $$;

commit;
