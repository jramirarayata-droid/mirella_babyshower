-- =============================================================================
--  MIR & ELLA WEDDING — SAMPLE DATA (FOR TESTING ONLY)
--  Run AFTER schema.sql in: Supabase Dashboard → SQL Editor.
--
--  Every sample invitation code starts with "sample-" so the sample data can be
--  removed safely before launch with the statement at the bottom of this file.
-- =============================================================================

insert into public.invitations (invitee_name, invitation_code, table_number, max_additional_guests, is_active)
values
  ('Juan Dela Cruz',   'sample-juan',   '5',            1, true),
  ('Maria Santos',     'sample-maria',  'VIP',          2, true),
  ('Pedro Reyes',      'sample-pedro',  'Family Table', 0, true),
  ('Ana Villanueva',   'sample-ana',    'A1',           3, true),
  ('Carlos Mendoza',   'sample-carlos', 'Table 10',     1, false)  -- inactive: must NOT be found by search
on conflict (invitation_code) do nothing;


-- =============================================================================
--  REMOVE SAMPLE DATA BEFORE LAUNCH
--  Deleting the invitations also deletes their RSVP responses and additional
--  guests automatically (ON DELETE CASCADE). Copy the line below (without the
--  leading "--") into the SQL Editor and run it:
--
--  delete from public.invitations where invitation_code like 'sample-%';
-- =============================================================================
