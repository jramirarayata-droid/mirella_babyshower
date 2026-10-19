-- Isolation and plan tests for 046. Run as postgres on a migrated test database.
\set ON_ERROR_STOP 0
\pset tuples_only on
\pset format unaligned

create or replace function public.t_ok(p_name text, p_pass boolean) returns text language sql as $$
  select (case when p_pass then 'PASS ' else 'FAIL ' end) || p_name $$;
grant execute on function public.t_ok(text, boolean) to anon, authenticated;

-- A second customer login and a super admin request context.
insert into public.accounts (user_id, username, display_name) values ('22222222-2222-2222-2222-222222222222', 'bea', 'Bea');

-- ---------------------------------------------------------------- super admin creates the space
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select set_config('request.headers', '{}', false);
select public.t_ok('super admin is super admin', public.is_super_admin());
select public.owner_save_space(null, 'ana-cruz', 'Baby Cruz', 'sprout', true, null, 'paid gcash') is not null as created;
select public.owner_set_member('22222222-2222-2222-2222-222222222222', (select (x->>'id')::uuid from jsonb_array_elements(public.owner_spaces()) x where x->>'slug' = 'ana-cruz'), true);
select public.t_ok('owner sees 2 spaces', jsonb_array_length(public.owner_spaces()) = 2);
reset role;

-- ---------------------------------------------------------------- customer Bea in her own space
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
select set_config('request.headers', '{"x-space":"ana-cruz"}', false);
select public.t_ok('Bea is admin of her space', public.is_admin());
select public.t_ok('Bea is not super admin', not public.is_super_admin());
select public.t_ok('my_account lists her one space', jsonb_array_length(public.my_account()->'spaces') = 1);
insert into public.invitations (invitee_name) values ('Bea Guest One');
select public.t_ok('Bea sees only her 1 invitation (not the 40 others)', (select count(*) from public.invitations) = 1);
select public.t_ok('her settings row exists', (select count(*) from public.wedding_settings) = 1);
select public.t_ok('her settings title', (select hero_title from public.wedding_settings) = 'Baby Cruz');
-- looks
update public.wedding_settings set theme = '{"template":"clouds-pink"}';
select public.t_ok('Clouds look allowed on Little Sprout', (select theme->>'template' from public.wedding_settings) = 'clouds-pink');
do $$ begin
  update public.wedding_settings set theme = '{"template":"balloons-pastel"}';
  raise notice 'FAIL Balloons look blocked on Little Sprout';
exception when others then raise notice 'PASS Balloons look blocked on Little Sprout (%)', sqlerrm; end $$;
-- gender reveal not in plan
do $$ begin
  update public.gender_reveal set answer = 'girl' where id = 1;
  if found then raise notice 'FAIL reveal change blocked on Little Sprout'; else raise notice 'FAIL reveal row not visible'; end if;
exception when others then raise notice 'PASS reveal change blocked on Little Sprout (%)', sqlerrm; end $$;
-- admin preference upsert per space
insert into public.admin_preferences (key, value) values ('registry', '{"mode":"hidden"}') on conflict (space_id, key) do update set value = excluded.value;
select public.t_ok('preference saved in her space', (select value->>'mode' from public.admin_preferences where key = 'registry') = 'hidden');

-- Bea pointing at the default space sees nothing and can change nothing.
select set_config('request.headers', '{"x-space":"mirella"}', false);
select public.t_ok('Bea is not admin of mirella', not public.is_admin());
select public.t_ok('Bea sees 0 mirella invitations', (select count(*) from public.invitations) = 0);
do $$ begin
  insert into public.invitations (invitee_name) values ('Sneaky');
  raise notice 'FAIL Bea cannot add to mirella';
exception when others then raise notice 'PASS Bea cannot add to mirella'; end $$;
-- …nor without any header (= default space)
select set_config('request.headers', '{}', false);
select public.t_ok('Bea is not admin of the default space', not public.is_admin());
reset role;

-- ---------------------------------------------------------------- guests (anon)
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select set_config('request.headers', '{}', false);
select public.t_ok('no header: default space guest found', (select count(*) from public.find_invitation('Lourdes Santos')) > 0);
select public.t_ok('no header: Bea''s guest not found', (select count(*) from public.find_invitation('Bea Guest One')) = 0);
select set_config('request.headers', '{"x-space":"ana-cruz"}', false);
select public.t_ok('ana-cruz: her guest found', (select count(*) from public.find_invitation('Bea Guest One')) > 0);
select public.t_ok('ana-cruz: mirella guest not found', (select count(*) from public.find_invitation('Lourdes Santos')) = 0);
select public.t_ok('space_public open', (public.space_public('ana-cruz')->>'open')::boolean);
select set_config('request.headers', '{"x-space":"no-such-place"}', false);
select public.t_ok('unknown address: nothing found', (select count(*) from public.find_invitation('Lourdes Santos')) = 0);
select public.t_ok('unknown address: space_public says no', not (public.space_public('no-such-place')->>'exists')::boolean);
reset role;

-- predictions: not in Little Sprout, works in the full default space
set role anon;
select set_config('request.headers', '{"x-space":"ana-cruz"}', false);
select set_config('request.jwt.claims', '{"role":"anon"}', false);
create temp table if not exists tok (space text, token text);
reset role;
grant all on tok to anon;
set role anon;
insert into tok select 'ana', public.shower_guest_start('Bea Guest One')->>'token';
select public.t_ok('guest sign-in in ana-cruz', (select token from tok where space = 'ana') is not null);
do $$ declare r jsonb; begin
  r := public.prediction_save((select token from tok where space = 'ana'), '2027-05-01', 3.1, 'girl');
  if coalesce(r->>'ok', 'false') = 'true' then raise notice 'FAIL prediction blocked on Little Sprout (%)', r; else raise notice 'PASS prediction refused on Little Sprout (%)', r; end if;
exception when others then raise notice 'PASS prediction blocked on Little Sprout (%)', sqlerrm; end $$;
select set_config('request.headers', '{}', false);
insert into tok select 'home', public.shower_guest_start('Lourdes Santos')->>'token';
select public.t_ok('prediction saved in the default (full) space', (public.prediction_save((select token from tok where space = 'home'), '2027-05-01', 3.1, 'girl')->>'ok')::boolean);
select set_config('request.headers', '{"x-space":"ana-cruz"}', false);
select public.t_ok('a mirella guest pass does not work in ana-cruz', coalesce((public.prediction_save((select token from tok where space = 'home'), '2027-05-02', 3.2, 'boy')->>'ok')::boolean, false) = false);
reset role;

-- ---------------------------------------------------------------- guest limit (40 on Little Sprout)
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
select set_config('request.headers', '{"x-space":"ana-cruz"}', false);
insert into public.invitations (invitee_name) select 'Guest ' || g from generate_series(2, 40) g;
select public.t_ok('40 guests allowed', (select count(*) from public.invitations where is_active) = 40);
do $$ begin
  insert into public.invitations (invitee_name) values ('Guest 41');
  raise notice 'FAIL 41st guest blocked';
exception when others then raise notice 'PASS 41st guest blocked (%)', sqlerrm; end $$;
-- co-host not in plan
reset role;

-- ---------------------------------------------------------------- switch the space off
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select public.owner_save_space((select id from public.space_public('ana-cruz') x, lateral (select (x->>'id')::uuid as id) y), 'ana-cruz', 'Baby Cruz', 'sprout', false, null, '') is not null;
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select set_config('request.headers', '{"x-space":"ana-cruz"}', false);
select public.t_ok('switched off: guests find nothing', (select count(*) from public.find_invitation('Bea Guest One')) = 0);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
select public.t_ok('switched off: Bea is not admin', not public.is_admin());
select public.t_ok('switched off: Bea sees no rows', (select count(*) from public.invitations) = 0);
select public.t_ok('switched off: my_account still answers (open=false)', (public.my_account()->'spaces'->0->>'open')::boolean = false);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select public.t_ok('switched off: super admin still sees it', (select count(*) from public.invitations) = 40);
reset role;

-- ---------------------------------------------------------------- default space keeps working for its admin
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', false);
select set_config('request.headers', '{}', false);
select public.t_ok('default admin sees the 40 sample invitations', (select count(*) from public.invitations) = 40);
select public.t_ok('raffle code can be set in the full plan', public.raffle_host_set_code('2468') is not null);
reset role;

-- ---------------------------------------------------------------- plain anon / bea cannot read spaces or accounts tables
set role anon;
do $$ begin perform 1 from public.spaces; raise notice 'FAIL anon can read spaces'; exception when others then raise notice 'PASS anon cannot read spaces'; end $$;
do $$ begin perform 1 from public.accounts; raise notice 'FAIL anon can read accounts'; exception when others then raise notice 'PASS anon cannot read accounts'; end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', false);
do $$ begin perform public.owner_spaces(); raise notice 'FAIL bea cannot use owner tools'; exception when others then raise notice 'PASS bea cannot use owner tools'; end $$;
reset role;
