/*
# Real room inventory for Perhentian Bay Chalet

1. Overview
- Replaces the 4 placeholder room types with the chalet's real 22 rooms, grouped into 14 bookable room types.
- Rooms 1-6 Quad Seaview, 7-10 Quad Hillview, 11 Triple Seaside, 12 Superior Seaview Double, 13 Superior Seaview Twin,
  14 Family Suite Seaview, 15 Standard Seaside Twin, 16 Standard Seaside Double, 17 Family Suite Seaside, 18 Quad Seaside,
  19 Quintuple Seaside, 20 Family Premium Seaview, 21 Family Villa Seaview A, 22 Family Villa Seaview B.

2. Modified data (room_types)
- The 4 existing rows are updated in place (same ids) so any booking that references them stays valid.
- 10 new rows are inserted (idempotent on slug).
- Rates: Normal Weekday = the agent standard rate supplied; Weekend = +RM30; Peak Holiday = +RM60; Low Monsoon = -RM50.
  Super Admin can change these at any time from "Bilik & Harga".

3. Demo seed functions
- demo_seed_bookings and demo_seed_history are rewritten (text substitution on their current definitions) to use the new
  room slugs, choose pax from each room's capacity and never request more units than a room type has.

4. Security
- No policy or grant changes.
*/

UPDATE room_types SET slug = 'quad-hillview', name = 'Quad Hillview', total_units = 4, max_adults = 4, max_children = 1,
  description = 'Bilik No. 7-10. Bilik 4 orang menghadap bukit, suasana tenang dan redup.',
  rate_low_monsoon = 230, rate_normal_weekday = 280, rate_weekend = 310, rate_peak_holiday = 340, sort_order = 2, is_active = true
WHERE id = 'a79d81b0-663c-4bc4-95b2-2d2e84ad9f7e' AND slug = 'garden-fan';

UPDATE room_types SET slug = 'standard-seaside-double', name = 'Standard Seaside Double', total_units = 1, max_adults = 2, max_children = 1,
  description = 'Bilik No. 16. Bilik 2 orang dengan 1 katil double, beberapa langkah ke pantai.',
  rate_low_monsoon = 200, rate_normal_weekday = 250, rate_weekend = 280, rate_peak_holiday = 310, sort_order = 8, is_active = true
WHERE id = 'febb488e-0543-4d7c-9774-8fedefac96d5' AND slug = 'std-ac-double';

UPDATE room_types SET slug = 'quad-seaview', name = 'Quad Seaview', total_units = 6, max_adults = 4, max_children = 1,
  description = 'Bilik No. 1-6. Bilik 4 orang dengan pemandangan laut terus dari beranda. (No. 2 juga dikenali sebagai Quadruple Rock.)',
  rate_low_monsoon = 300, rate_normal_weekday = 350, rate_weekend = 380, rate_peak_holiday = 410, sort_order = 1, is_active = true
WHERE id = '656f3b5c-2aa7-4023-acd2-adb294409740' AND slug = 'sea-view-deluxe';

UPDATE room_types SET slug = 'family-suite-seaview', name = 'Family Suite Seaview', total_units = 1, max_adults = 4, max_children = 2,
  description = 'Bilik No. 14. Suite keluarga yang luas menghadap laut.',
  rate_low_monsoon = 320, rate_normal_weekday = 370, rate_weekend = 400, rate_peak_holiday = 430, sort_order = 6, is_active = true
WHERE id = 'e0692673-1b77-4ab6-85a8-ad28166f59a6' AND slug = 'family-room';

INSERT INTO room_types (slug, name, description, image_url, total_units, max_adults, max_children,
  rate_low_monsoon, rate_normal_weekday, rate_weekend, rate_peak_holiday, sort_order, is_active) VALUES
('triple-seaside', 'Triple Seaside', 'Bilik No. 11. Bilik 3 orang di tepi pantai.',
  'https://images.pexels.com/photos/4825701/pexels-photo-4825701.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1, 3, 1, 210, 260, 290, 320, 3, true),
('superior-seaview-double', 'Superior Seaview Double', 'Bilik No. 12. Bilik superior 1 katil double dengan pemandangan laut.',
  'https://images.pexels.com/photos/28843954/pexels-photo-28843954.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1, 2, 1, 250, 300, 330, 360, 4, true),
('superior-seaview-twin', 'Superior Seaview Twin', 'Bilik No. 13. Bilik superior 2 katil single dengan pemandangan laut.',
  'https://images.pexels.com/photos/6775271/pexels-photo-6775271.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1, 2, 1, 250, 300, 330, 360, 5, true),
('standard-seaside-twin', 'Standard Seaside Twin', 'Bilik No. 15. Bilik 2 orang dengan 2 katil single, dekat pantai.',
  'https://images.pexels.com/photos/14025911/pexels-photo-14025911.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1, 2, 1, 200, 250, 280, 310, 7, true),
('family-suite-seaside', 'Family Suite Seaside', 'Bilik No. 17. Suite keluarga 4-5 orang di tepi pantai.',
  'https://images.pexels.com/photos/30708776/pexels-photo-30708776.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1, 4, 2, 300, 350, 380, 410, 9, true),
('quad-seaside', 'Quad Seaside', 'Bilik No. 18. Bilik 4 orang di tepi pantai.',
  'https://images.pexels.com/photos/30708768/pexels-photo-30708768.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1, 4, 1, 250, 300, 330, 360, 10, true),
('quintuple-seaside', 'Quintuple Seaside', 'Bilik No. 19. Bilik 5 orang di tepi pantai, sesuai untuk kumpulan kecil.',
  'https://images.pexels.com/photos/33549432/pexels-photo-33549432.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1, 5, 1, 300, 350, 380, 410, 11, true),
('family-premium-seaview', 'Family Premium Seaview', 'Bilik No. 20. Bilik keluarga premium menghadap laut.',
  'https://images.pexels.com/photos/2476632/pexels-photo-2476632.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1, 4, 2, 320, 370, 400, 430, 12, true),
('family-villa-seaview-a', 'Family Villa Seaview A', 'Bilik No. 21. Villa keluarga menghadap laut.',
  'https://images.pexels.com/photos/12720677/pexels-photo-12720677.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1, 6, 2, 380, 430, 460, 490, 13, true),
('family-villa-seaview-b', 'Family Villa Seaview B', 'Bilik No. 22. Villa keluarga paling luas dan eksklusif, menghadap laut.',
  'https://images.pexels.com/photos/33154338/pexels-photo-33154338.jpeg?auto=compress&cs=tinysrgb&h=650&w=940', 1, 6, 2, 430, 480, 510, 540, 14, true)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('public.demo_seed_bookings()'::regprocedure);
  v_def := replace(v_def, '''garden-fan''', '''quad-hillview''');
  v_def := replace(v_def, '''std-ac-double''', '''quad-seaview''');
  v_def := replace(v_def, '''sea-view-deluxe''', '''quad-seaview''');
  v_def := replace(v_def, '''family-room''', '''family-suite-seaview''');
  EXECUTE v_def;

  v_def := pg_get_functiondef('public.demo_seed_history()'::regprocedure);
  v_def := replace(v_def,
    'ARRAY[''garden-fan'',''std-ac-double'',''std-ac-double'',''sea-view-deluxe'',''sea-view-deluxe'',''family-room'']',
    'ARRAY[''quad-seaview'',''quad-seaview'',''quad-seaview'',''quad-hillview'',''quad-hillview'',''triple-seaside'',''superior-seaview-double'',''superior-seaview-twin'',''family-suite-seaview'',''standard-seaside-twin'',''standard-seaside-double'',''family-suite-seaside'',''quad-seaside'',''quintuple-seaside'',''family-premium-seaview'',''family-villa-seaview-a'',''family-villa-seaview-b'']');
  v_def := replace(v_def,
    '(ARRAY[''garden-fan'',''std-ac-double''])[1 + floor(random() * 2)::int]',
    '(ARRAY[''standard-seaside-double'',''standard-seaside-twin'',''triple-seaside'',''quad-hillview''])[1 + floor(random() * 4)::int]');
  v_def := replace(v_def,
    'ELSE 1 + floor(random() * 3)::int END;',
    'ELSE LEAST(v_room.total_units, 1 + floor(random() * 3)::int) END;');
  v_def := replace(v_def,
    'v_qty * CASE WHEN v_room.slug = ''family-room'' THEN 3 + floor(random() * 2)::int ELSE 2 END',
    'v_qty * GREATEST(1, v_room.max_adults - floor(random() * 2)::int)');
  v_def := replace(v_def,
    'CASE WHEN v_room.slug IN (''family-room'',''sea-view-deluxe'') THEN floor(random() * 2)::int * v_qty ELSE 0 END',
    'floor(random() * (v_room.max_children + 1))::int * v_qty');
  IF v_def LIKE '%family-room%' OR v_def LIKE '%garden-fan%' OR v_def NOT LIKE '%LEAST(v_room.total_units%'
     OR v_def NOT LIKE '%v_room.max_children + 1%' THEN
    RAISE EXCEPTION 'demo_seed_history rewrite did not apply cleanly';
  END IF;
  EXECUTE v_def;

  IF pg_get_functiondef('public.demo_seed_bookings()'::regprocedure) LIKE '%garden-fan%' THEN
    RAISE EXCEPTION 'demo_seed_bookings rewrite did not apply cleanly';
  END IF;
END $$;
