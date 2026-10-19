-- Existing guest/admin flows still work after 046, in the default space and in a new "bundle" space.
\pset tuples_only on
\pset format unaligned
create temp table t2 (k text, v text);
grant all on t2 to anon, authenticated;

-- super admin makes a Sweet Bundle space for Bea's sister and adds Bea to it (Bundle has no co-host, Bea is the only admin)
insert into public.accounts (user_id, username) values ('33333333-3333-3333-3333-333333333333', 'cora');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select set_config('request.headers', '{}', false);
insert into t2 select 'bundle', public.owner_save_space(null, 'baby-lim', 'Baby Lim', 'bundle', true, current_date + 60, '')::text;
select public.owner_set_member('33333333-3333-3333-3333-333333333333', (select v::uuid from t2 where k = 'bundle'), true);
-- co-host rule: a second admin on a Bundle space is refused
do $$ begin
  perform public.owner_set_member('22222222-2222-2222-2222-222222222222', (select v::uuid from t2 where k = 'bundle'), true);
  raise notice 'FAIL co-host refused on Sweet Bundle';
exception when others then raise notice 'PASS co-host refused on Sweet Bundle (%)', sqlerrm; end $$;
reset role;

-- Cora sets up her wishlist and reveal
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);
select set_config('request.headers', '{"x-space":"baby-lim"}', false);
insert into public.invitations (invitee_name) values ('Lim Guest');
insert into public.registry_items (title, quantity) values ('Crib', 1);
do $$ begin
  update public.gender_reveal set answer = 'boy', enabled = true, reveal_at = now() - interval '1 minute' where id = 1;
  if found then raise notice 'PASS reveal saved on Sweet Bundle'; else raise notice 'FAIL reveal row missing on Sweet Bundle'; end if;
exception when others then raise notice 'FAIL reveal saved on Sweet Bundle (%)', sqlerrm; end $$;
update public.wedding_settings set theme = '{"template":"balloons-pastel"}';
select 'PASS balloons look on Sweet Bundle' where (select theme->>'template' from public.wedding_settings) = 'balloons-pastel';
reset role;

-- A Lim guest: wishlist, names, reveal
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select set_config('request.headers', '{"x-space":"baby-lim"}', false);
insert into t2 select 'tok', public.shower_guest_start('Lim Guest')->>'token';
do $$ declare r jsonb; it uuid; begin
  r := public.registry_list((select v from t2 where k = 'tok'));
  it := (r->'items'->0->>'id')::uuid;
  if jsonb_array_length(r->'items') = 1 then raise notice 'PASS Lim wishlist shows only her item'; else raise notice 'FAIL Lim wishlist items: %', r->'items'; end if;
  r := public.registry_claim((select v from t2 where k = 'tok'), it, 1);
  if (r->>'ok')::boolean then raise notice 'PASS Lim guest claims the crib'; else raise notice 'FAIL claim: %', r; end if;
exception when others then raise notice 'FAIL Lim wishlist (%)', sqlerrm; end $$;
do $$ declare r jsonb; begin
  r := public.name_idea_add((select v from t2 where k = 'tok'), 'Lucas', 'boy', '');
  if (r->>'ok')::boolean then raise notice 'PASS Lim name idea'; else raise notice 'FAIL name idea: %', r; end if;
exception when others then raise notice 'FAIL Lim name idea (%)', sqlerrm; end $$;
select 'PASS Lim names list has Lucas' where public.name_ideas_list()::text ~ 'Lucas';
select 'PASS Lim reveal shows boy' where public.public_gender_reveal()->>'answer' = 'boy';
-- the default space's reveal is still a secret / separate
select set_config('request.headers', '{}', false);
select 'PASS default reveal not boy' where coalesce(public.public_gender_reveal()->>'answer', '') <> 'boy';
select 'PASS default names list has no Lucas' where public.name_ideas_list()::text !~ 'Lucas';
-- default wishlist still works
insert into t2 select 'tok0', public.shower_guest_start('Lourdes Santos')->>'token';
do $$ declare r jsonb; begin
  r := public.registry_list((select v from t2 where k = 'tok0'));
  if r::text !~ 'Crib' and jsonb_array_length(r->'items') > 0 then raise notice 'PASS default wishlist unchanged (% items)', jsonb_array_length(r->'items'); else raise notice 'FAIL default wishlist: %', r; end if;
exception when others then raise notice 'FAIL default wishlist (%)', sqlerrm; end $$;
-- guest photos in the default space (full plan)
do $$ declare r jsonb; begin
  r := public.guest_photo_start('Lourdes Santos');
  if r ? 'token' or (r->>'ok')::boolean then raise notice 'PASS guest photo session'; else raise notice 'INFO guest photo start: %', r; end if;
exception when others then raise notice 'FAIL guest photo start (%)', sqlerrm; end $$;
reset role;

-- live slideshow signal goes to the space's own channel
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);
select set_config('request.headers', '{"x-space":"baby-lim"}', false);
select 'PASS guest photo topic per space' where public.guest_photo_topic() = 'guest-photos:baby-lim';
select set_config('request.headers', '{}', false);
select 'PASS default topic unchanged' where public.guest_photo_topic() = 'guest-photos';
reset role;

-- storage: Cora can upload under her own space folder, not under the default one
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', false);
select set_config('request.headers', '{}', false);
do $$ begin
  insert into storage.objects (bucket_id, name) values ('wedding-assets', (select v from t2 where k = 'bundle') || '/hero.jpg');
  raise notice 'PASS Cora uploads into her folder';
exception when others then raise notice 'FAIL Cora uploads into her folder (%)', sqlerrm; end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('wedding-assets', 'hero-sneaky.jpg');
  raise notice 'FAIL Cora blocked from the default space files';
exception when others then raise notice 'PASS Cora blocked from the default space files'; end $$;
reset role;
