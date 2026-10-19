-- 021: remove one particular chair from a table (Admin → Seating).
-- The chair must be empty (the page unassigns whoever sits there first). The
-- chairs after it move down by one place, and the table gets one chair fewer:
-- removing chair 3 of 8 leaves 7 chairs, and chair 4 becomes chair 3, and so on.

create or replace function public.remove_table_seat(p_table_id uuid, p_seat_index integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap integer;
  r record;
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  select capacity into v_cap from public.seating_tables where id = p_table_id for update;
  if v_cap is null then
    raise exception 'TABLE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_cap <= 1 then
    raise exception 'LAST_CHAIR' using errcode = '22023';
  end if;
  if p_seat_index is null or p_seat_index < 0 or p_seat_index >= v_cap then
    raise exception 'SEAT_OUT_OF_RANGE' using errcode = '22023';
  end if;
  if exists (select 1 from public.seat_assignments where table_id = p_table_id and seat_index = p_seat_index) then
    raise exception 'SEAT_TAKEN' using errcode = '22023';
  end if;

  -- One chair at a time, lowest first, so no two guests ever share a chair number.
  for r in
    select id from public.seat_assignments
    where table_id = p_table_id and seat_index > p_seat_index
    order by seat_index
  loop
    update public.seat_assignments set seat_index = seat_index - 1 where id = r.id;
  end loop;

  update public.seating_tables set capacity = v_cap - 1 where id = p_table_id;
  return v_cap - 1;
end;
$$;

revoke all on function public.remove_table_seat(uuid, integer) from public, anon;
grant execute on function public.remove_table_seat(uuid, integer) to authenticated;
