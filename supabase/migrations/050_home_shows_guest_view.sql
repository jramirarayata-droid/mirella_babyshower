-- =============================================================================
--  050 — The home page shows what guests see (needs 048)
--
--  registry_list() lets signed-in admins see a hidden wishlist (so they can test
--  it). The home page and the guest menu used that same answer, so admins saw
--  the "Gifts, Guesses & Names" section even with everything switched off.
--  registry_list() now also returns guestVisible: what this visitor would see as
--  a guest. Nothing else changes.
--
--  Safe to run twice.
-- =============================================================================

begin;

do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'spaces') then
    raise exception 'STOP: this is not the baby shower project. Run this only in Mir and Ella Babyshower.';
  end if;
end $$;

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
      from public.registry_items r where r.is_visible), '[]'::jsonb));
end;
$$;

grant execute on function public.registry_list(text) to anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'tenant_fn') then
    alter function public.registry_list(text) owner to tenant_fn;
  end if;
end $$;

commit;
