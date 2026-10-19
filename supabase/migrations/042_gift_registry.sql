-- =============================================================================
--  042 — Gift registry ("I'll bring this") and the shower guest pass
--  Run after 041. Safe to run twice. Only adds tables and functions.
--
--  * Guest pass: a guest types their name as on the invitation (or an included
--    guest's name) once; the same session as photo sharing is used, so a guest
--    who shared photos is already known. shower_guest_start(name) → {token}.
--  * registry_items: the wishlist (admin only). registry_claims: who said
--    "I'll bring this" (admin only). Guests never see who claimed what — only
--    how many are still needed and their own claims.
--  * registry_claim() locks the item row, so two guests can't take the last
--    one at the same moment: the second gets {ok:false, reason:'taken'}.
--  * admin_preferences 'registry' = {mode, from, title, intro}:
--    mode hidden | visible | scheduled (from) | reveal (Schedule's reveal date).
-- =============================================================================

-- ------------------------------------------------------------------ guest pass
-- Who is this? A session for any shower activity (registry, predictions, name
-- ideas, photos). Same rules as photo sharing: the full name as on the
-- invitation, or an included / approved guest's name.
create or replace function public.shower_guest_start(p_name text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_norm text := public.normalize_name(p_name);
  v_inv uuid;
  v_guest uuid;
  v_person text;
  v_token text;
begin
  if char_length(coalesce(v_norm, '')) < 3 then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  select i.id, i.invitee_name into v_inv, v_person from public.invitations i where i.is_active and i.search_name = v_norm limit 1;
  if v_inv is null then
    select g.invitation_id, g.id, g.guest_name into v_inv, v_guest, v_person
    from public.additional_guests g join public.invitations i on i.id = g.invitation_id
    where i.is_active and public.normalize_name(g.guest_name) = v_norm and (g.added_by = 'admin' or g.status = 'approved')
    limit 1;
  end if;
  if v_inv is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.guest_photo_sessions (token, invitation_id, guest_id, name, expires_at)
  values (v_token, v_inv, v_guest, btrim(v_person), now() + interval '90 days');
  return jsonb_build_object('ok', true, 'token', v_token, 'name', btrim(v_person));
end;
$$;

-- The person behind a session token (internal).
create or replace function public.shower_person(p_token text)
returns table (invitation_id uuid, guest_id uuid, name text)
language sql stable security definer set search_path = ''
as $$
  select s.invitation_id, s.guest_id, s.name
  from public.guest_photo_sessions s join public.invitations i on i.id = s.invitation_id
  where s.token = p_token and s.expires_at > now() and i.is_active
  limit 1;
$$;

revoke all on function public.shower_guest_start(text) from public;
grant execute on function public.shower_guest_start(text) to anon, authenticated;
revoke all on function public.shower_person(text) from public, anon, authenticated;

-- ------------------------------------------------------------------ tables
create table if not exists public.registry_items (
  id          uuid primary key default gen_random_uuid(),
  title       varchar(120) not null check (char_length(btrim(title)) >= 1),
  note        varchar(300),
  link        text check (link is null or (link ~* '^https://' and char_length(link) <= 1000)),
  image_url   text check (image_url is null or (image_url ~* '^https://' and char_length(image_url) <= 1000)),
  price_hint  varchar(40),
  quantity    integer not null default 1 check (quantity between 1 and 99),
  sort_order  integer not null default 0,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists registry_items_updated_at on public.registry_items;
create trigger registry_items_updated_at before update on public.registry_items for each row execute function public.set_updated_at();

create table if not exists public.registry_claims (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.registry_items(id) on delete cascade,
  invitation_id uuid references public.invitations(id) on delete cascade,
  guest_id      uuid references public.additional_guests(id) on delete cascade,
  name          text not null,
  qty           integer not null default 1 check (qty between 1 and 99),
  created_at    timestamptz not null default now()
);
create index if not exists registry_claims_item_idx on public.registry_claims (item_id);
create unique index if not exists registry_claims_person_uniq
  on public.registry_claims (item_id, invitation_id, coalesce(guest_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.registry_items enable row level security;
alter table public.registry_claims enable row level security;
drop policy if exists "Admins manage registry items" on public.registry_items;
create policy "Admins manage registry items" on public.registry_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins manage registry claims" on public.registry_claims;
create policy "Admins manage registry claims" on public.registry_claims for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.registry_items, public.registry_claims from anon;
grant select, insert, update, delete on public.registry_items, public.registry_claims to authenticated;

-- ------------------------------------------------------------------ settings
create or replace function public.registry_cfg()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce((select value from public.admin_preferences where key = 'registry'), '{}'::jsonb);
$$;
revoke all on function public.registry_cfg() from public, anon, authenticated;

create or replace function public.registry_visible()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.timing_on(c->>'mode', c->>'from') from (select public.registry_cfg() c) x;
$$;
revoke all on function public.registry_visible() from public, anon, authenticated;

-- ------------------------------------------------------------------ public
-- The wishlist: each item with how many are still needed, and (with a token)
-- how many this guest said they'll bring. Never anyone else's name.
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
  select * into p from public.shower_person(p_token);
  return jsonb_build_object(
    'visible', true,
    'title', coalesce(nullif(btrim(c->>'title'), ''), 'Gift Wishlist'),
    'intro', coalesce(c->>'intro', ''),
    'me', p.name,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'title', r.title, 'note', r.note, 'link', r.link, 'image', r.image_url, 'price', r.price_hint,
        'quantity', r.quantity,
        'claimed', coalesce((select sum(k.qty) from public.registry_claims k where k.item_id = r.id), 0),
        'mine', coalesce((select sum(k.qty) from public.registry_claims k
                          where k.item_id = r.id and p.invitation_id is not null and k.invitation_id = p.invitation_id
                            and k.guest_id is not distinct from p.guest_id), 0))
        order by r.sort_order, r.created_at)
      from public.registry_items r where r.is_visible), '[]'::jsonb));
end;
$$;

-- "I'll bring this" (p_qty more of it). One claim row per guest per item.
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
  select * into it from public.registry_items where id = p_item and is_visible for update;
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

-- Changed my mind: take back my claim on an item.
create or replace function public.registry_unclaim(p_token text, p_item uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  p record;
begin
  select * into p from public.shower_person(p_token);
  if p.invitation_id is null then
    return jsonb_build_object('ok', false, 'reason', 'who');
  end if;
  delete from public.registry_claims
  where item_id = p_item and invitation_id = p.invitation_id and guest_id is not distinct from p.guest_id;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.registry_list(text) from public;
revoke all on function public.registry_claim(text, uuid, int) from public;
revoke all on function public.registry_unclaim(text, uuid) from public;
grant execute on function public.registry_list(text) to anon, authenticated;
grant execute on function public.registry_claim(text, uuid, int) to anon, authenticated;
grant execute on function public.registry_unclaim(text, uuid) to anon, authenticated;

-- The wishlist shows on the website from the start (Admin → Gift Registry can hide it).
insert into public.admin_preferences (key, value)
values ('registry', '{"mode": "visible", "title": "Gift Wishlist", "intro": "If you would like to bring a gift, here are a few things our little one needs. Tap “I’ll bring this” so nothing is doubled."}'::jsonb)
on conflict (key) do nothing;
