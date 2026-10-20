-- =============================================================================
--  BABY SHOWER — TEST DATA (FAKE NAMES, FOR TESTING ONLY)
--  Run AFTER schema.sql and the migrations, in the Supabase SQL Editor of the
--  BABY SHOWER project only.
--
--  40 made-up invitations (codes start with "sample-"), a few test RSVPs and a
--  starter gift wishlist. Everything here can be removed before launch with the
--  statements at the bottom of this file.
-- =============================================================================

insert into public.invitations (invitee_name, invitation_code, max_additional_guests, is_active, side, position_mode, position_label)
values
  ('Lourdes Santos', 'sample-01', 1, true, 'groom', 'custom', 'Lola'),
  ('Ernesto Santos', 'sample-02', 0, true, 'groom', 'custom', 'Lolo'),
  ('Carmela Reyes', 'sample-03', 1, true, 'bride', 'custom', 'Lola'),
  ('Rogelio Reyes', 'sample-04', 0, true, 'bride', 'custom', 'Lolo'),
  ('Ana Villanueva', 'sample-05', 1, true, 'bride', 'custom', 'Ninang'),
  ('Pedro Ramos', 'sample-06', 1, true, 'groom', 'custom', 'Ninong'),
  ('Kristine Navarro', 'sample-07', 0, true, 'bride', 'custom', 'Ninang'),
  ('Mark Soriano', 'sample-08', 0, true, 'groom', 'custom', 'Ninong'),
  ('Bea Aquino', 'sample-09', 1, true, 'bride', 'none', null),
  ('Paolo Aquino', 'sample-10', 0, true, 'groom', 'none', null),
  ('Rina Garcia', 'sample-11', 2, true, 'bride', 'none', null),
  ('Ramon Garcia', 'sample-12', 2, true, 'groom', 'none', null),
  ('Tess Mendoza', 'sample-13', 0, true, 'bride', 'none', null),
  ('Jose Mendoza', 'sample-14', 1, true, 'groom', 'none', null),
  ('Gloria Castillo', 'sample-15', 0, true, 'bride', 'none', null),
  ('Fernando Castillo', 'sample-16', 0, true, 'groom', 'none', null),
  ('Carla Morales', 'sample-17', 1, true, 'bride', 'none', null),
  ('Ben Torres', 'sample-18', 0, true, 'groom', 'none', null),
  ('Liza Bautista', 'sample-19', 0, true, 'bride', 'none', null),
  ('Ricardo Bautista', 'sample-20', 1, true, 'groom', 'none', null),
  ('Joy Fernandez', 'sample-21', 0, true, 'bride', 'none', null),
  ('Miguel Fernandez', 'sample-22', 0, true, 'groom', 'none', null),
  ('Princess Cruz', 'sample-23', 0, true, 'bride', 'none', null),
  ('Santi Cruz', 'sample-24', 0, true, 'groom', 'none', null),
  ('Nena Villareal', 'sample-25', 0, true, 'bride', 'custom', 'Tita'),
  ('Boy Villareal', 'sample-26', 0, true, 'groom', 'custom', 'Tito'),
  ('Mae Dizon', 'sample-27', 1, true, 'bride', 'none', null),
  ('Carlo Dizon', 'sample-28', 0, true, 'groom', 'none', null),
  ('Elena Pascual', 'sample-29', 0, true, 'bride', 'none', null),
  ('Victor Pascual', 'sample-30', 0, true, 'groom', 'none', null),
  ('Hannah Lim', 'sample-31', 0, true, 'bride', 'none', null),
  ('Kevin Tan', 'sample-32', 1, true, 'groom', 'none', null),
  ('Joanna Uy', 'sample-33', 0, true, 'bride', 'none', null),
  ('Patrick Go', 'sample-34', 0, true, 'groom', 'none', null),
  ('Celia Ocampo', 'sample-35', 0, true, 'bride', 'none', null),
  ('Dante Ocampo', 'sample-36', 0, true, 'groom', 'none', null),
  ('Irene Salazar', 'sample-37', 1, true, 'bride', 'none', null),
  ('Noel Salazar', 'sample-38', 0, true, 'groom', 'none', null),
  ('Mika Javier', 'sample-39', 0, true, 'bride', 'none', null),
  ('Luis Javier', 'sample-40', 0, false, 'groom', 'none', null)  -- the last one is inactive: must NOT be found by the name search
on conflict (space_id, invitation_code) do nothing;

-- A few test replies so the dashboard has something to show.
insert into public.rsvp_responses (invitation_id, attendance_status, recorded_by_admin)
select i.id, 'attending', true from public.invitations i
where i.invitation_code in ('sample-01', 'sample-02', 'sample-03', 'sample-05', 'sample-06', 'sample-09', 'sample-11', 'sample-12', 'sample-14', 'sample-17', 'sample-20', 'sample-25', 'sample-27', 'sample-31')
on conflict (invitation_id) do nothing;

insert into public.rsvp_responses (invitation_id, attendance_status, recorded_by_admin)
select i.id, 'declining', true from public.invitations i
where i.invitation_code in ('sample-08', 'sample-16', 'sample-23')
on conflict (invitation_id) do nothing;

-- A starter gift wishlist (only added when the wishlist is still empty).
insert into public.registry_items (title, note, quantity, sort_order)
select v.title, v.note, v.quantity, v.sort_order
from (values
  ('Diapers (newborn & size 1)', 'Any brand — we’ll need lots!', 10, 1),
  ('Baby wipes', 'Unscented, please.', 10, 2),
  ('Swaddle blankets', null, 4, 3),
  ('Onesies (0–3 months)', 'Soft cotton, any colour.', 6, 4),
  ('Baby bath tub', null, 1, 5),
  ('Stroller', 'Light and foldable.', 1, 6),
  ('Baby carrier', null, 1, 7),
  ('Feeding bottles', null, 4, 8)
) as v(title, note, quantity, sort_order)
where not exists (select 1 from public.registry_items);


-- =============================================================================
--  REMOVE THE TEST DATA BEFORE LAUNCH
--  Deleting the invitations also deletes their replies and guests
--  (ON DELETE CASCADE). Copy the lines below (without the leading "--") into
--  the SQL Editor and run them:
--
--  delete from public.invitations where invitation_code like 'sample-%';
--  delete from public.registry_items where title in ('Diapers (newborn & size 1)', 'Baby wipes',
--    'Swaddle blankets', 'Onesies (0–3 months)', 'Baby bath tub', 'Stroller', 'Baby carrier', 'Feeding bottles');
-- =============================================================================
