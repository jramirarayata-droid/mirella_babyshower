-- =============================================================================
--  MIGRATION 006 — RSVP question builder
--  * built-in questions can be switched off / renamed (wedding_settings.rsvp_config)
--  * custom questions with types, required, audience and "show only if" rules
--  * answers validated server-side and stored in rsvp_responses.custom_answers
--  Run AFTER 005. Safe to re-run. (Already applied to the live project.)
-- =============================================================================

alter table public.wedding_settings
  add column if not exists rsvp_config jsonb not null default '{}'::jsonb;
alter table public.wedding_settings drop constraint if exists wedding_settings_rsvp_config_is_object;
alter table public.wedding_settings add constraint wedding_settings_rsvp_config_is_object
  check (jsonb_typeof(rsvp_config) = 'object' and pg_column_size(rsvp_config) < 4000);

alter table public.rsvp_responses
  add column if not exists custom_answers jsonb not null default '{}'::jsonb;
alter table public.rsvp_responses drop constraint if exists rsvp_custom_answers_is_object;
alter table public.rsvp_responses add constraint rsvp_custom_answers_is_object
  check (jsonb_typeof(custom_answers) = 'object' and pg_column_size(custom_answers) < 20000);

create table if not exists public.rsvp_questions (
  id              uuid primary key default gen_random_uuid(),
  question        varchar(200) not null,
  help_text       varchar(300),
  type            text not null,
  options         jsonb not null default '[]'::jsonb,
  max_selections  integer,
  min_value       numeric,
  max_value       numeric,
  max_length      integer,
  required        boolean not null default false,
  audience        text not null default 'attending',
  show_if         jsonb,
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint rsvp_questions_text_required check (char_length(btrim(question)) >= 1),
  constraint rsvp_questions_type_valid check (type in ('single', 'multiple', 'yes_no', 'short_text', 'long_text', 'number')),
  constraint rsvp_questions_audience_valid check (audience in ('all', 'attending', 'declining')),
  constraint rsvp_questions_options_valid check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 20),
  constraint rsvp_questions_choice_has_options check (type not in ('single', 'multiple') or jsonb_array_length(options) >= 2),
  constraint rsvp_questions_max_selections_valid check (max_selections is null or max_selections >= 1),
  constraint rsvp_questions_max_length_valid check (max_length is null or max_length between 1 and 1000),
  constraint rsvp_questions_show_if_valid check (show_if is null or (jsonb_typeof(show_if) = 'object' and show_if ? 'questionId' and jsonb_typeof(show_if -> 'values') = 'array'))
);
create index if not exists rsvp_questions_order_idx on public.rsvp_questions (sort_order);

drop trigger if exists rsvp_questions_updated_at on public.rsvp_questions;
create trigger rsvp_questions_updated_at before update on public.rsvp_questions for each row execute function public.set_updated_at();

create or replace function public.enforce_question_limit()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.rsvp_questions) >= 30 then
    raise exception 'QUESTION_LIMIT_REACHED' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists rsvp_questions_limit on public.rsvp_questions;
create trigger rsvp_questions_limit before insert on public.rsvp_questions for each row execute function public.enforce_question_limit();

alter table public.rsvp_questions enable row level security;
drop policy if exists "Public can read active questions" on public.rsvp_questions;
create policy "Public can read active questions" on public.rsvp_questions for select to anon, authenticated using (is_active);
drop policy if exists "Admins can read questions" on public.rsvp_questions;
create policy "Admins can read questions" on public.rsvp_questions for select to authenticated using (public.is_admin());
drop policy if exists "Admins can insert questions" on public.rsvp_questions;
create policy "Admins can insert questions" on public.rsvp_questions for insert to authenticated with check (public.is_admin());
drop policy if exists "Admins can update questions" on public.rsvp_questions;
create policy "Admins can update questions" on public.rsvp_questions for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins can delete questions" on public.rsvp_questions;
create policy "Admins can delete questions" on public.rsvp_questions for delete to authenticated using (public.is_admin());
revoke all on public.rsvp_questions from anon;
grant select on public.rsvp_questions to anon;
grant select, insert, update, delete on public.rsvp_questions to authenticated;

create or replace function public.log_question_activity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    return coalesce(new, old);
  end if;
  insert into public.admin_activity_logs (admin_user_id, action, target_table, target_id, details)
  values (auth.uid(),
          case tg_op when 'INSERT' then 'question_added' when 'DELETE' then 'question_deleted' else 'question_updated' end,
          'rsvp_questions', coalesce(new.id, old.id), jsonb_build_object('question', coalesce(new.question, old.question)));
  return coalesce(new, old);
end;
$$;
drop trigger if exists rsvp_questions_activity_log on public.rsvp_questions;
create trigger rsvp_questions_activity_log after insert or update or delete on public.rsvp_questions for each row execute function public.log_question_activity();

-- -----------------------------------------------------------------------------
-- Validates custom answers against the active questions.
-- Returns the cleaned answers; raises RSVP_INVALID for bad/missing required ones.
-- Questions that aren't shown (audience / "show only if") are dropped.
-- -----------------------------------------------------------------------------
create or replace function public.validate_custom_answers(p_attendance text, p_answers jsonb)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  q public.rsvp_questions%rowtype;
  v_clean jsonb := '{}'::jsonb;
  v_raw jsonb;
  v_val jsonb;
  v_dep jsonb;
  v_text text;
  v_num numeric;
  v_items text[];
  v_item text;
  v_max int;
begin
  p_answers := coalesce(p_answers, '{}'::jsonb);
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'RSVP_INVALID: custom_answers' using errcode = '22023';
  end if;

  for q in select * from public.rsvp_questions where is_active order by sort_order, created_at loop
    if q.audience = 'attending' and p_attendance <> 'attending' then continue; end if;
    if q.audience = 'declining' and p_attendance <> 'declining' then continue; end if;

    if q.show_if is not null then
      v_dep := v_clean -> (q.show_if ->> 'questionId');
      if v_dep is null then continue; end if;
      if not exists (
        select 1 from jsonb_array_elements_text(q.show_if -> 'values') c(val)
        where (jsonb_typeof(v_dep) = 'array' and v_dep ? c.val) or (jsonb_typeof(v_dep) = 'string' and v_dep #>> '{}' = c.val)
      ) then continue; end if;
    end if;

    v_raw := p_answers -> q.id::text;
    v_val := null;

    if v_raw is not null and jsonb_typeof(v_raw) <> 'null' then
      if q.type in ('single', 'yes_no') then
        if jsonb_typeof(v_raw) <> 'string' then raise exception 'RSVP_INVALID: question %', q.id using errcode = '22023'; end if;
        v_text := v_raw #>> '{}';
        if v_text <> '' then
          if q.type = 'yes_no' and v_text not in ('yes', 'no') then raise exception 'RSVP_INVALID: question %', q.id using errcode = '22023'; end if;
          if q.type = 'single' and not (q.options ? v_text) then raise exception 'RSVP_INVALID: question %', q.id using errcode = '22023'; end if;
          v_val := to_jsonb(v_text);
        end if;

      elsif q.type = 'multiple' then
        if jsonb_typeof(v_raw) <> 'array' then raise exception 'RSVP_INVALID: question %', q.id using errcode = '22023'; end if;
        select coalesce(array_agg(distinct e), '{}') into v_items from jsonb_array_elements_text(v_raw) e;
        foreach v_item in array v_items loop
          if not (q.options ? v_item) then raise exception 'RSVP_INVALID: question %', q.id using errcode = '22023'; end if;
        end loop;
        v_max := coalesce(q.max_selections, jsonb_array_length(q.options));
        if cardinality(v_items) > v_max then raise exception 'RSVP_INVALID: question %', q.id using errcode = '22023'; end if;
        if cardinality(v_items) > 0 then
          -- keep the admin's option order
          select jsonb_agg(o order by ord) into v_val
          from jsonb_array_elements_text(q.options) with ordinality as t(o, ord) where o = any(v_items);
        end if;

      elsif q.type in ('short_text', 'long_text') then
        if jsonb_typeof(v_raw) <> 'string' then raise exception 'RSVP_INVALID: question %', q.id using errcode = '22023'; end if;
        v_text := btrim(v_raw #>> '{}');
        if char_length(v_text) > coalesce(q.max_length, case q.type when 'short_text' then 120 else 500 end) then
          raise exception 'RSVP_INVALID: question %', q.id using errcode = '22023';
        end if;
        if v_text <> '' then v_val := to_jsonb(v_text); end if;

      elsif q.type = 'number' then
        begin
          v_num := (v_raw #>> '{}')::numeric;
        exception when others then
          raise exception 'RSVP_INVALID: question %', q.id using errcode = '22023';
        end;
        if v_num is not null then
          if (q.min_value is not null and v_num < q.min_value) or (q.max_value is not null and v_num > q.max_value) then
            raise exception 'RSVP_INVALID: question %', q.id using errcode = '22023';
          end if;
          v_val := to_jsonb(v_num);
        end if;
      end if;
    end if;

    if v_val is null then
      if q.required then raise exception 'RSVP_INVALID: required question %', q.id using errcode = '22023'; end if;
    else
      v_clean := v_clean || jsonb_build_object(q.id::text, v_val);
    end if;
  end loop;

  return v_clean;
end;
$$;

-- -----------------------------------------------------------------------------
-- submit_rsvp — honours switched-off built-in questions and saves custom answers
-- -----------------------------------------------------------------------------
drop function if exists public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text);
drop function if exists public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text, jsonb);
create function public.submit_rsvp(
  p_invitation_id uuid, p_attendance_status text,
  p_has_transportation boolean default null, p_needs_transportation text default null,
  p_vehicle_type text default null, p_coming_from text default null,
  p_food_preferences text[] default '{}', p_has_food_restrictions boolean default null,
  p_food_restrictions text default null, p_accessibility_needs text default null,
  p_additional_guests text[] default '{}', p_message_to_couple text default null,
  p_mobile_number text default null, p_custom_answers jsonb default '{}'::jsonb
)
returns table (rsvp_id uuid, attendance_status text)
language plpgsql volatile security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_invitation public.invitations%rowtype;
  v_rsvp_id uuid;
  v_guests text[] := '{}';
  v_food text[] := '{}';
  v_name text;
  v_coming_from text;
  v_restrictions text;
  v_access text;
  v_message text;
  v_mobile text;
  v_custom jsonb;
  v_cfg jsonb;
  v_transport_on boolean;
  v_coming_on boolean;
  v_coming_req boolean;
  v_food_on boolean;
  v_dietary_on boolean;
  v_access_on boolean;
  v_message_on boolean;
  v_has_transport boolean;
  v_has_restrictions boolean;
begin
  if not public.rsvp_is_open() then
    raise exception 'RSVP_CLOSED' using errcode = 'P0001';
  end if;

  select * into v_invitation from public.invitations where id = p_invitation_id and is_active for update;
  if not found then
    raise exception 'RSVP_INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_attendance_status is null or p_attendance_status not in ('attending', 'declining') then
    raise exception 'RSVP_INVALID: attendance' using errcode = '22023';
  end if;

  v_mobile := public.normalize_ph_mobile(p_mobile_number);
  if v_mobile is null then
    raise exception 'RSVP_INVALID: mobile_number' using errcode = '22023';
  end if;

  select coalesce(rsvp_config -> 'builtins', '{}'::jsonb) into v_cfg from public.wedding_settings limit 1;
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  v_transport_on := coalesce((v_cfg #>> '{transportation,enabled}')::boolean, true);
  v_coming_on    := coalesce((v_cfg #>> '{comingFrom,enabled}')::boolean, true);
  v_coming_req   := coalesce((v_cfg #>> '{comingFrom,required}')::boolean, true);
  v_food_on      := coalesce((v_cfg #>> '{food,enabled}')::boolean, true);
  v_dietary_on   := coalesce((v_cfg #>> '{dietary,enabled}')::boolean, true);
  v_access_on    := coalesce((v_cfg #>> '{accessibility,enabled}')::boolean, true);
  v_message_on   := coalesce((v_cfg #>> '{message,enabled}')::boolean, true);

  if p_attendance_status = 'attending' then
    if v_transport_on then
      if p_has_transportation is null then
        raise exception 'RSVP_INVALID: transportation' using errcode = '22023';
      end if;
      if p_has_transportation then
        if p_vehicle_type is null or p_vehicle_type not in ('sedan', 'suv', 'van', 'motorcycle', 'other') then
          raise exception 'RSVP_INVALID: vehicle_type' using errcode = '22023';
        end if;
      else
        if p_needs_transportation is null or p_needs_transportation not in ('yes', 'no', 'not_sure') then
          raise exception 'RSVP_INVALID: needs_transportation' using errcode = '22023';
        end if;
      end if;
      v_has_transport := p_has_transportation;
    end if;

    if v_coming_on then
      v_coming_from := nullif(regexp_replace(btrim(coalesce(p_coming_from, '')), '\s+', ' ', 'g'), '');
      if (v_coming_req and v_coming_from is null) or char_length(coalesce(v_coming_from, '')) > 120 then
        raise exception 'RSVP_INVALID: coming_from' using errcode = '22023';
      end if;
    end if;

    if v_food_on then
      select coalesce(array_agg(distinct f order by f), '{}') into v_food from unnest(coalesce(p_food_preferences, '{}')) as f;
      if cardinality(v_food) > 4 or not (v_food <@ array['vegetable', 'pasta', 'fish', 'pork', 'beef', 'chicken']::text[]) then
        raise exception 'RSVP_INVALID: food_preferences' using errcode = '22023';
      end if;
    end if;

    if v_dietary_on then
      if p_has_food_restrictions is null then
        raise exception 'RSVP_INVALID: has_food_restrictions' using errcode = '22023';
      end if;
      v_has_restrictions := p_has_food_restrictions;
      if p_has_food_restrictions then
        v_restrictions := nullif(btrim(coalesce(p_food_restrictions, '')), '');
        if v_restrictions is null or char_length(v_restrictions) > 120 then
          raise exception 'RSVP_INVALID: food_restrictions' using errcode = '22023';
        end if;
      end if;
    end if;

    if v_access_on then
      v_access := nullif(btrim(coalesce(p_accessibility_needs, '')), '');
      if v_access is not null and char_length(v_access) > 255 then
        raise exception 'RSVP_INVALID: accessibility_needs' using errcode = '22023';
      end if;
    end if;

    if v_message_on then
      v_message := nullif(btrim(coalesce(p_message_to_couple, '')), '');
      if v_message is not null and char_length(v_message) > 500 then
        raise exception 'RSVP_INVALID: message_to_couple' using errcode = '22023';
      end if;
    end if;

    foreach v_name in array coalesce(p_additional_guests, '{}') loop
      v_name := regexp_replace(btrim(coalesce(v_name, '')), '\s+', ' ', 'g');
      if v_name = '' then
        raise exception 'RSVP_INVALID: guest_name_empty' using errcode = '22023';
      end if;
      if char_length(v_name) > 150 then
        raise exception 'RSVP_INVALID: guest_name_length' using errcode = '22023';
      end if;
      if exists (select 1 from unnest(v_guests) g where public.normalize_name(g) = public.normalize_name(v_name)) then
        raise exception 'RSVP_INVALID: guest_name_duplicate' using errcode = '22023';
      end if;
      if not exists (select 1 from public.additional_guests ag
                     where ag.invitation_id = v_invitation.id and ag.added_by = 'admin'
                       and public.normalize_name(ag.guest_name) = public.normalize_name(v_name)) then
        v_guests := array_append(v_guests, v_name);
      end if;
    end loop;

    if cardinality(v_guests) > v_invitation.max_additional_guests then
      raise exception 'RSVP_INVALID: too_many_guests' using errcode = '22023';
    end if;
  end if;

  v_custom := public.validate_custom_answers(p_attendance_status, p_custom_answers);

  insert into public.rsvp_responses as r (
    invitation_id, attendance_status, has_transportation, needs_transportation,
    vehicle_type, coming_from, food_preferences, has_food_restrictions,
    food_restrictions, accessibility_needs, bringing_additional_guest,
    message_to_couple, mobile_number, custom_answers, submitted_at, updated_at
  ) values (
    v_invitation.id, p_attendance_status,
    case when p_attendance_status = 'attending' then v_has_transport end,
    case when p_attendance_status = 'attending' and v_has_transport = false then p_needs_transportation end,
    case when p_attendance_status = 'attending' and v_has_transport then p_vehicle_type end,
    case when p_attendance_status = 'attending' then v_coming_from end,
    case when p_attendance_status = 'attending' then v_food else '{}'::text[] end,
    case when p_attendance_status = 'attending' then v_has_restrictions end,
    case when p_attendance_status = 'attending' and v_has_restrictions then v_restrictions end,
    case when p_attendance_status = 'attending' then v_access end,
    p_attendance_status = 'attending' and cardinality(v_guests) > 0,
    case when p_attendance_status = 'attending' then v_message end,
    v_mobile,
    v_custom,
    now(), now()
  )
  on conflict (invitation_id) do update set
    attendance_status = excluded.attendance_status,
    has_transportation = excluded.has_transportation,
    needs_transportation = excluded.needs_transportation,
    vehicle_type = excluded.vehicle_type,
    coming_from = excluded.coming_from,
    food_preferences = excluded.food_preferences,
    has_food_restrictions = excluded.has_food_restrictions,
    food_restrictions = excluded.food_restrictions,
    accessibility_needs = excluded.accessibility_needs,
    bringing_additional_guest = excluded.bringing_additional_guest,
    message_to_couple = excluded.message_to_couple,
    mobile_number = excluded.mobile_number,
    custom_answers = excluded.custom_answers
  returning r.id into v_rsvp_id;

  delete from public.additional_guests ag
  where ag.invitation_id = v_invitation.id and ag.added_by = 'invitee'
    and (ag.rsvp_response_id <> v_rsvp_id
         or not exists (select 1 from unnest(v_guests) g where public.normalize_name(g) = public.normalize_name(ag.guest_name)));

  insert into public.additional_guests (invitation_id, rsvp_response_id, guest_name, status, added_by)
  select v_invitation.id, v_rsvp_id, g, 'pending', 'invitee'
  from unnest(v_guests) g
  where not exists (select 1 from public.additional_guests ag
                    where ag.invitation_id = v_invitation.id and public.normalize_name(ag.guest_name) = public.normalize_name(g));

  return query select v_rsvp_id, p_attendance_status;
end;
$$;

revoke execute on function public.enforce_question_limit() from public, anon, authenticated;
revoke execute on function public.log_question_activity() from public, anon, authenticated;
revoke execute on function public.validate_custom_answers(text, jsonb) from public, anon, authenticated;
revoke execute on function public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text, jsonb) from public;
grant execute on function public.submit_rsvp(uuid, text, boolean, text, text, text, text[], boolean, text, text, text[], text, text, jsonb) to anon, authenticated;
