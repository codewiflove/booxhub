/*
# Demo: real agent directory and May-Sep 2026 sales history

1. New Tables
- `demo_agent_directory` (private, server-only): the 33 B2B agents used in demo mode
  (BLUE STAR, REH, KRAVERS, ... SALZAN) with a target revenue for May-Sep 2026.
  - `key` (text, pk), `email`, `company_name`, `full_name`, `phone`, `license_no`,
    `target_revenue` (numeric, RM), `sort_order`.
  - BLUE STAR is mapped to the "Demo Ejen" login (ejen@demo.perhentianbay.my).

2. New Functions
- `demo_seed_history()`: for every agent in the directory, generates FULLY_PAID bookings
  with check-in between 1 May and 30 Sep 2026 until the agent's total is close to its target.
  Prices are calculated from the real room rates and add-on rates; room capacity per night is respected.
  Each booking gets its rooms, verified deposit + balance payments and timeline events.

3. Modified Functions
- `demo_prepare_profiles()`: all directory agents become approved demo agents with their company details.
- `demo_prepare_accounts()` and `reset_demo_data()`: also run the history seed.

4. Security
- Directory table has RLS enabled with no policies; anon/authenticated have no access.
- New helper is not executable by anon/authenticated.
- Only demo profiles/bookings are affected; real data is untouched.
*/

CREATE TABLE IF NOT EXISTS demo_agent_directory (
  key text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  company_name text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  license_no text NOT NULL DEFAULT '',
  target_revenue numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0
);
ALTER TABLE demo_agent_directory ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON demo_agent_directory FROM anon, authenticated;

INSERT INTO demo_agent_directory (key, email, company_name, full_name, phone, license_no, target_revenue, sort_order)
SELECT v.key,
  CASE WHEN v.key = 'bluestar' THEN 'ejen@demo.perhentianbay.my' ELSE v.key || '@demo.perhentianbay.my' END,
  v.company, 'Wakil ' || v.company,
  '+60 1' || (2 + v.ord % 8) || '-' || lpad(((v.ord * 7919) % 1000)::text, 3, '0') || ' ' || lpad(((v.ord * 104729) % 10000)::text, 4, '0'),
  'KPK/LN ' || (8000 + v.ord * 37),
  v.target, v.ord
FROM (VALUES
  ('bluestar','BLUE STAR',53480,1), ('reh','REH',44768,2), ('kravers','KRAVERS',33890,3),
  ('isv','ISV',14980,4), ('malika','MALIKA',11420,5), ('abang','ABANG',10916,6),
  ('sunrise','SUNRISE',8770,7), ('eyza','EYZA',6140,8), ('venture','VENTURE',5988,9),
  ('anakgajah','ANAK GAJAH',5310,10), ('vacaysea','VACAYSEA',4800,11), ('people','PEOPLE',4400,12),
  ('sandora','SANDORA',4000,13), ('nemo','NEMO',3600,14), ('trans','TRANS',3300,15),
  ('duyung','DUYUNG',3000,16), ('miha','MIHA',2700,17), ('anjung','ANJUNG',2450,18),
  ('qalynn','QALYNN',2200,19), ('islandstation','ISLAND STATION',2000,20), ('dhia','DHIA',1800,21),
  ('angah','ANGAH',1600,22), ('kawkaw','KAW KAW',1400,23), ('ohana','OHANA',1250,24),
  ('gtnew','GT NEW',1100,25), ('adnan','ADNAN',950,26), ('twin','TWIN',800,27),
  ('linda','LINDA',700,28), ('aina','AINA',600,29), ('ainholiday','AIN HOLIDAY',500,30),
  ('aamaldives','AA MALDIVES',450,31), ('suyah','SUYAH',400,32), ('salzan','SALZAN',350,33)
) AS v(key, company, target, ord)
ON CONFLICT (key) DO UPDATE SET email = EXCLUDED.email, company_name = EXCLUDED.company_name,
  full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, license_no = EXCLUDED.license_no,
  target_revenue = EXCLUDED.target_revenue, sort_order = EXCLUDED.sort_order;

CREATE OR REPLACE FUNCTION demo_prepare_profiles() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE profiles SET role = 'super_admin', status = 'approved', full_name = 'Demo Admin',
    company_name = 'Perhentian Bay Chalet', phone = '+60 9-697 0000', license_no = '',
    consecutive_expired = 0, hold_blocked = false
  WHERE is_demo AND email = 'admin@demo.perhentianbay.my';
  UPDATE profiles p SET role = 'agent', status = 'approved', full_name = d.full_name,
    company_name = d.company_name, phone = d.phone, license_no = d.license_no,
    consecutive_expired = 0, hold_blocked = false
  FROM demo_agent_directory d
  WHERE p.is_demo AND p.email = d.email;
  UPDATE profiles SET role = 'agent', status = 'pending', full_name = 'Rosli Ahmad',
    company_name = 'Pantai Timur Holidays Sdn Bhd', phone = '+60 13-912 4410', license_no = 'KPK/LN 10234',
    consecutive_expired = 0, hold_blocked = false
  WHERE is_demo AND email = 'pemohon1@demo.perhentianbay.my';
  UPDATE profiles SET role = 'agent', status = 'pending', full_name = 'Grace Tan',
    company_name = 'Island Hop Tours', phone = '+60 17-305 7781', license_no = 'KPK/LN 11870',
    consecutive_expired = 0, hold_blocked = false
  WHERE is_demo AND email = 'pemohon2@demo.perhentianbay.my';
$$;

CREATE OR REPLACE FUNCTION demo_seed_history() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid;
  v_dir record;
  v_agent uuid;
  v_room room_types;
  v_slugs text[] := ARRAY['garden-fan','std-ac-double','std-ac-double','sea-view-deluxe','sea-view-deluxe','family-room'];
  v_first text[] := ARRAY['Ahmad','Nur','Siti','Mohd','Farah','Amir','Hana','Lim','Tan','Wong','Kumar','Priya','Aiman','Zulaikha','Haziq','Liyana','Irfan','Balqis','Chong','Danish'];
  v_last text[] := ARRAY['Rahman','Ismail','Abdullah','Hassan','Yusof','Ali','Wei Ming','Mei Ling','Kok Leong','Raj','Devi','Salleh','Omar','Zakaria','Hamzah'];
  v_flights text[] := ARRAY['AK6292','AK6290','MH1336','MH1334','OD1802','FY2210'];
  b_adult numeric; b_child numeric; vr_adult numeric; vr_child numeric; s_adult numeric; s_child numeric;
  v_sum numeric; v_tries int; v_rem numeric; v_small boolean;
  v_qty int; v_nights int; v_in date; v_out date; v_day date; v_rate numeric;
  v_adults int; v_children int; v_room_total numeric; v_breakdown jsonb;
  v_boat boolean; v_boat_total numeric; v_van text; v_van_total numeric; v_flight text; v_ftime text;
  v_sn_a int; v_sn_c int; v_sn_total numeric; v_total numeric; v_dep numeric;
  v_max int; v_created timestamptz; v_bal_at timestamptz; v_code text; v_id uuid;
BEGIN
  SELECT id INTO v_admin FROM profiles WHERE is_demo AND email = 'admin@demo.perhentianbay.my';
  IF v_admin IS NULL THEN RETURN; END IF;

  SELECT price_adult, price_child INTO b_adult, b_child FROM addon_rates WHERE key = 'boat_return';
  SELECT price_adult, price_child INTO vr_adult, vr_child FROM addon_rates WHERE key = 'van_return';
  SELECT price_adult, price_child INTO s_adult, s_child FROM addon_rates WHERE key = 'snorkeling';

  FOR v_dir IN SELECT d.*, p.id AS profile_id FROM demo_agent_directory d
      JOIN profiles p ON p.email = d.email AND p.is_demo ORDER BY d.sort_order LOOP
    v_agent := v_dir.profile_id;
    v_sum := 0; v_tries := 0;

    WHILE v_sum < v_dir.target_revenue - 150 AND v_tries < 400 LOOP
      v_tries := v_tries + 1;
      v_rem := v_dir.target_revenue - v_sum;
      v_small := v_rem < 900;

      IF v_small THEN
        SELECT * INTO v_room FROM room_types WHERE is_active
          AND slug = (ARRAY['garden-fan','std-ac-double'])[1 + floor(random() * 2)::int];
      ELSE
        SELECT * INTO v_room FROM room_types WHERE is_active
          AND slug = v_slugs[1 + floor(random() * array_length(v_slugs, 1))::int];
      END IF;
      CONTINUE WHEN v_room.id IS NULL;

      v_qty := CASE WHEN v_small THEN 1 ELSE 1 + floor(random() * 3)::int END;
      v_nights := CASE WHEN v_small THEN 1 + floor(random() * 2)::int ELSE 2 + floor(random() * 2)::int END;
      v_in := date '2026-05-01' + floor(random() * (153 - v_nights))::int;
      v_out := v_in + v_nights;

      v_adults := v_qty * CASE WHEN v_room.slug = 'family-room' THEN 3 + floor(random() * 2)::int ELSE 2 END;
      v_children := CASE WHEN v_room.slug IN ('family-room','sea-view-deluxe') THEN floor(random() * 2)::int * v_qty ELSE 0 END;

      v_room_total := 0; v_breakdown := '[]'::jsonb;
      FOR v_day IN SELECT generate_series(v_in, v_out - 1, interval '1 day')::date LOOP
        v_rate := rate_for(v_room, season_for(v_day));
        v_room_total := v_room_total + v_rate * v_qty;
        v_breakdown := v_breakdown || jsonb_build_object('date', v_day, 'room', v_room.name,
          'season', season_for(v_day), 'rate', v_rate, 'quantity', v_qty);
      END LOOP;

      v_boat := random() < CASE WHEN v_small THEN 0.5 ELSE 0.85 END;
      v_boat_total := CASE WHEN v_boat THEN b_adult * v_adults + b_child * v_children ELSE 0 END;
      v_van := CASE WHEN NOT v_small AND random() < 0.3 THEN 'return' ELSE 'none' END;
      v_van_total := CASE WHEN v_van = 'return' THEN vr_adult * v_adults + vr_child * v_children ELSE 0 END;
      v_flight := CASE WHEN v_van = 'return' THEN v_flights[1 + floor(random() * 6)::int] ELSE '' END;
      v_ftime := CASE WHEN v_van = 'return' THEN lpad((7 + floor(random() * 10))::int::text, 2, '0') || ':' || (ARRAY['05','20','35','50'])[1 + floor(random() * 4)::int] ELSE '' END;
      IF NOT v_small AND random() < 0.4 THEN v_sn_a := v_adults; v_sn_c := v_children; ELSE v_sn_a := 0; v_sn_c := 0; END IF;
      v_sn_total := s_adult * v_sn_a + s_child * v_sn_c;

      v_total := v_room_total + v_boat_total + v_van_total + v_sn_total;
      CONTINUE WHEN v_sum + v_total > v_dir.target_revenue + 250;

      SELECT COALESCE(MAX(occ), 0) INTO v_max FROM (
        SELECT d.d, SUM(br.quantity) AS occ
        FROM generate_series(v_in, v_out - 1, interval '1 day') AS d(d)
        JOIN bookings b ON d.d::date >= b.check_in AND d.d::date < b.check_out AND b.status IN ('CONFIRMED_PARTIAL','FULLY_PAID')
        JOIN booking_rooms br ON br.booking_id = b.id AND br.room_type_id = v_room.id
        JOIN profiles p ON p.id = b.agent_id AND p.is_demo
        GROUP BY d.d) x;
      CONTINUE WHEN v_max + v_qty > v_room.total_units;

      v_dep := round(v_total * 0.25, 2);
      v_created := (v_in - (7 + floor(random() * 40))::int)::timestamptz + make_interval(hours => 9 + floor(random() * 10)::int);
      v_bal_at := GREATEST(v_created + interval '2 days', (v_in - 8)::timestamptz + interval '11 hours');

      LOOP
        v_code := 'PBC-' || to_char(v_created, 'YYMM') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM bookings WHERE code = v_code);
      END LOOP;

      INSERT INTO bookings (code, agent_id, status, hold_hours, hold_expires_at, check_in, check_out, nights,
        adults, children, lead_guest_name, lead_guest_phone, nightly_breakdown, room_total,
        include_boat, boat_adult, boat_child, boat_total, van_type, van_adult, van_child,
        flight_number, flight_arrival_time, van_total, snorkel_adult, snorkel_child, snorkel_total,
        grand_total, deposit_required, paid_amount, balance_due_date, created_at, updated_at)
      VALUES (v_code, v_agent, 'FULLY_PAID', 48, v_created + interval '48 hours', v_in, v_out, v_nights,
        v_adults, v_children,
        v_first[1 + floor(random() * array_length(v_first, 1))::int] || ' ' || v_last[1 + floor(random() * array_length(v_last, 1))::int],
        '+60 1' || (1 + floor(random() * 9))::int || '-' || lpad(floor(random() * 10000000)::int::text, 7, '0'),
        v_breakdown, v_room_total,
        v_boat, CASE WHEN v_boat THEN v_adults ELSE 0 END, CASE WHEN v_boat THEN v_children ELSE 0 END, v_boat_total,
        v_van, CASE WHEN v_van <> 'none' THEN v_adults ELSE 0 END, CASE WHEN v_van <> 'none' THEN v_children ELSE 0 END,
        v_flight, v_ftime, v_van_total, v_sn_a, v_sn_c, v_sn_total,
        v_total, v_dep, v_total, GREATEST(v_created::date, v_in - 7), v_created, v_bal_at)
      RETURNING id INTO v_id;

      INSERT INTO booking_rooms (booking_id, room_type_id, room_name, quantity, subtotal)
      VALUES (v_id, v_room.id, v_room.name, v_qty, v_room_total);

      INSERT INTO payments (booking_id, agent_id, kind, amount, reference, receipt_path, status, reviewed_by, reviewed_at, created_at)
      VALUES (v_id, v_agent, 'DEPOSIT_25', v_dep, 'MBB' || upper(substr(md5(random()::text), 1, 8)), 'demo/resit-contoh.pdf',
        'VERIFIED', v_admin, v_created + interval '1 day', v_created + interval '3 hours');
      IF v_total - v_dep > 0 THEN
        INSERT INTO payments (booking_id, agent_id, kind, amount, reference, receipt_path, status, reviewed_by, reviewed_at, created_at)
        VALUES (v_id, v_agent, 'BALANCE_75', v_total - v_dep, 'CIMB' || upper(substr(md5(random()::text), 1, 8)), 'demo/resit-contoh.pdf',
          'VERIFIED', v_admin, v_bal_at, v_bal_at - interval '5 hours');
      END IF;

      INSERT INTO booking_events (booking_id, actor_id, event, detail, created_at) VALUES
        (v_id, v_agent, 'CREATED', 'Tempahan dibuat. Bilik dikunci selama 48 jam', v_created),
        (v_id, v_admin, 'PAYMENT_VERIFIED', 'Bayaran RM' || to_char(v_dep, 'FM999999990.00') || ' disahkan. Status: Disahkan (Deposit)', v_created + interval '1 day'),
        (v_id, v_admin, 'PAYMENT_VERIFIED', 'Bayaran RM' || to_char(v_total - v_dep, 'FM999999990.00') || ' disahkan. Status: Dibayar Penuh', v_bal_at);

      v_sum := v_sum + v_total;
    END LOOP;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION demo_prepare_accounts() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (SELECT demo_enabled FROM app_settings WHERE id = 1) THEN
    RAISE EXCEPTION 'Akses demo dimatikan';
  END IF;
  PERFORM demo_prepare_profiles();
  IF NOT EXISTS (SELECT 1 FROM bookings b JOIN profiles p ON p.id = b.agent_id WHERE p.is_demo) THEN
    PERFORM demo_seed_bookings();
    PERFORM demo_seed_history();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION reset_demo_data() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (caller_is_demo() OR is_super_admin()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('demo_reset'));
  DELETE FROM bookings WHERE agent_id IN (SELECT id FROM profiles WHERE is_demo);
  PERFORM demo_prepare_profiles();
  PERFORM restore_demo_config();
  PERFORM demo_seed_bookings();
  PERFORM demo_seed_history();
END;
$$;

REVOKE EXECUTE ON FUNCTION demo_seed_history() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION demo_prepare_profiles() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION demo_prepare_accounts() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION demo_prepare_accounts() TO service_role;
REVOKE EXECUTE ON FUNCTION reset_demo_data() FROM public, anon;
GRANT EXECUTE ON FUNCTION reset_demo_data() TO authenticated;
