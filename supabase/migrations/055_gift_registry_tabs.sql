-- =============================================================================
--  055 — Gift Registry: two tabs, one live (needs 054)
--
--  The Gift Registry has two tabs and the customer chooses which one guests
--  see (registry setting "active"):
--    'list'  — the gift list guests tap "I'll bring this" on (default)
--    'ideas' — gift ideas photos, shown as a photo gallery
--  The other stays saved but hidden. "Show on the website" (visible / hidden /
--  from a date) applies to whichever tab is live.
--  Gift ideas photos may now have no title (just a photo, or a caption).
--
--  Nothing changes for existing showers: without "active" the gift list is
--  live, as before. No data is changed.
--
--  Rollback (if ever needed): run 054_gift_ideas_section.sql again; then
--    alter table public.registry_items drop constraint registry_items_title_check;
--    alter table public.registry_items add constraint registry_items_title_check check (char_length(btrim(title)) >= 1);
--  (only after giving any untitled idea a title).
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

-- ------------------------------------------------------------------ 1. untitled idea photos
alter table public.registry_items drop constraint if exists registry_items_title_check;
alter table public.registry_items add constraint registry_items_title_check
  check (kind = 'idea' or char_length(btrim(title)) >= 1);

-- ------------------------------------------------------------------ 2. the gift list: only when it is the live tab
create or replace function public.registry_list(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  c jsonb := public.registry_cfg();
  p record;
  -- What this visitor would see as a guest (the home page and menu follow this, even for admins).
  -- Which tab is live on the website: the gift list (default) or the gift ideas photos.
  v_ideas boolean := coalesce(c->>'active', 'list') = 'ideas';
  v_guest boolean := not v_ideas and public.registry_visible() and (not public.guest_only('wishlist') or public.shower_attending(p_token));
begin
  if (v_ideas or not public.registry_visible()) and not public.is_admin() then
    return jsonb_build_object('visible', false, 'guestVisible', false, 'ideasLive', v_ideas and public.registry_visible(), 'items', '[]'::jsonb);
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

-- ------------------------------------------------------------------ 3. gift ideas: only when they are the live tab
-- { visible, private, listLive, title, intro, layout, items: [{ id, title, note, link, image }] }
-- Like the home page, this is always the guest's view (admins included).
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

grant execute on function public.registry_list(text) to anon, authenticated;
grant execute on function public.gift_ideas_list(text) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'tenant_fn') then
    alter function public.registry_list(text) owner to tenant_fn;
    alter function public.gift_ideas_list(text) owner to tenant_fn;
  end if;
end $$;

commit;
