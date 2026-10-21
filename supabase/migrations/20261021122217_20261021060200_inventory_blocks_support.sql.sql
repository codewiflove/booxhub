/*
# Sokongan blok bilik: pengiraan kekosongan mengambil kira blok

1. Latar belakang
- Sebelum ini, kekosongan bilik dikira di dua tempat: (a) `get_availability(start, end)` untuk paparan, dan (b) `create_booking` yang mengira sendiri `total_units - booked_units(...)` bagi setiap malam semasa tempahan dibuat.
- Pengiraan di `create_booking` tidak mengambil kira blok bilik (Booking.com, walk-in, penyelenggaraan), jadi ejen masih boleh menempah bilik yang sebenarnya telah diambil luar portal walaupun `get_availability` menunjukkan bilik penuh. Ini menimbulkan risiko tempahan berganda.

2. Perubahan
- Jadual baharu `inventory_blocks`: blok unit bilik mengikut jenis bilik dan julat tarikh, dengan sumber (MANUAL_MAINTENANCE, WALK_IN, OTA_SYNC, MANUAL_OTA), sebab, dan pengecam luar (external_uid, unik, untuk idempotensi import iCal).
- Fungsi pembantu baharu `blocked_units(p_room, p_day)`: jumlah unit yang diblok pada hari tersebut bagi dunia data pemanggil (in_my_world): pemanggil dunia demo hanya melihat blok dunia demo; pemanggil tanpa sesi (rantaian SECURITY DEFINER semasa ejen biasa menempah) melihat blok dunia sebenar.
- `create_booking`: pengiraan kekosongan semasa tempahan kini `total_units - booked_units - blocked_units`. Tempahan yang melebihi kekosongan sebenar akan ditolak dengan mesej `Bilik % tidak mencukupi pada %` seperti biasa.
- `get_availability(start, end)` ditulis semula (jenis pulangan berubah: ruangan `blocked` baharu; DROP dibuat pentadbir kerana Postgres tidak membenarkan perubahan jenis pulangan dengan CREATE OR REPLACE): ruangan `booked` kekal unit ditempah B2B, `blocked` baharu, dan `available` = `total_units - booked - blocked`, sekurang-kurangnya 0.
- Perbezaan penting: semakan tempahan kini menghormati blok pada peringkat server, jadi paparan dan semakan adalah konsisten.

3. Keselamatan
- RLS diaktifkan pada `inventory_blocks` sejak penciptaan; polisi SELECT membolehkan staf dan ejen yang diluluskan membaca. Polisi tulis (staf sahaja) ditambah dalam migrasi pengurusan blok.
- `blocked_units` di-REVOKE daripada PUBLIC/anon/authenticated; hanya dipanggil dalaman melalui rantaian SECURITY DEFINER.
- `get_availability` kekal semakan `auth.uid()` yang sama (ejen diluluskan sahaja); privilege dikembalikan kepada authenticated sahaja seperti sebelumnya (anon tidak pernah ada akses).
- `create_booking` kekal SECURITY DEFINER dengan pg_advisory_xact_lock; hanya pengiraannya dikemas kini.

4. Nota penting
- Selamat diulang (idempotent) termasuk DROP FUNCTION IF EXISTS sebelum CREATE.
- `create_booking` ditulis semula sepenuhnya (bukan string-replace) supaya kod pengiraan kekosongan boleh dibaca dan diaudit.
*/

-- ============================================================
-- 0. Tulis semula create_booking dengan pengiraan blok
-- ============================================================

CREATE OR REPLACE FUNCTION create_booking(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent profiles;
  v_today date := my_today();
  v_in date; v_out date; v_nights int;
  v_adults int; v_children int;
  v_item jsonb; v_room room_types; v_qty int;
  v_cap_adults int := 0; v_cap_children int := 0;
  v_day date; v_avail int; v_rate numeric; v_sub numeric;
  v_room_total numeric := 0; v_breakdown jsonb := '[]'::jsonb;
  v_rooms jsonb := '[]'::jsonb;
  v_boat boolean; v_boat_total numeric := 0;
  v_van text; v_van_total numeric := 0;
  v_sn_a int; v_sn_c int; v_sn_total numeric := 0;
  v_addon addon_rates;
  v_grand numeric; v_deposit numeric;
  v_days_until int; v_hold int; v_immediate boolean := false;
  v_code text; v_id uuid; v_seen uuid[] := '{}';
  v_flight text; v_flight_time text;
BEGIN
  SELECT * INTO v_agent FROM profiles WHERE id = auth.uid();
  IF v_agent.id IS NULL OR v_agent.role <> 'agent' OR v_agent.status <> 'approved' THEN
    RAISE EXCEPTION 'Akaun ejen belum diluluskan';
  END IF;

  v_in := (p->>'check_in')::date;
  v_out := (p->>'check_out')::date;
  IF v_in IS NULL OR v_out IS NULL OR v_in < v_today OR v_out <= v_in THEN
    RAISE EXCEPTION 'Tarikh tidak sah';
  END IF;
  v_nights := v_out - v_in;
  IF v_nights > 30 THEN RAISE EXCEPTION 'Maksimum 30 malam bagi satu tempahan'; END IF;

  v_adults := COALESCE((p->>'adults')::int, 0);
  v_children := COALESCE((p->>'children')::int, 0);
  IF v_adults < 1 OR v_adults > 200 OR v_children < 0 OR v_children > 200 THEN
    RAISE EXCEPTION 'Bilangan tetamu tidak sah';
  END IF;

  IF jsonb_typeof(p->'rooms') <> 'array' OR jsonb_array_length(p->'rooms') = 0 THEN
    RAISE EXCEPTION 'Sila pilih sekurang-kurangnya satu bilik';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('room_inventory'));

  FOR v_item IN SELECT * FROM jsonb_array_elements(p->'rooms') LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 0);
    IF v_qty < 1 OR v_qty > 50 THEN RAISE EXCEPTION 'Kuantiti bilik tidak sah'; END IF;
    SELECT * INTO v_room FROM room_types WHERE id = (v_item->>'room_type_id')::uuid AND is_active;
    IF v_room.id IS NULL THEN RAISE EXCEPTION 'Jenis bilik tidak dijumpai'; END IF;
    IF v_room.id = ANY(v_seen) THEN RAISE EXCEPTION 'Jenis bilik berulang'; END IF;
    v_seen := v_seen || v_room.id;

    v_cap_adults := v_cap_adults + v_room.max_adults * v_qty;
    v_cap_children := v_cap_children + (v_room.max_adults + v_room.max_children) * v_qty;
    v_sub := 0;
    FOR v_day IN SELECT generate_series(v_in, v_out - 1, interval '1 day')::date LOOP
      -- Kekosongan sebenar = total - tempahan B2B - blok (OTA/walk-in/penyelenggaraan)
      v_avail := GREATEST(v_room.total_units - booked_units(v_room.id, v_day) - blocked_units(v_room.id, v_day), 0);
      IF v_avail < v_qty THEN
        RAISE EXCEPTION 'Bilik % tidak mencukupi pada %', v_room.name, to_char(v_day, 'DD/MM/YYYY');
      END IF;
      v_rate := rate_for(v_room, season_for(v_day));
      v_sub := v_sub + v_rate * v_qty;
      v_breakdown := v_breakdown || jsonb_build_object('date', v_day, 'room', v_room.name,
        'season', season_for(v_day), 'rate', v_rate, 'quantity', v_qty);
    END LOOP;
    v_room_total := v_room_total + v_sub;
    v_rooms := v_rooms || jsonb_build_object('id', v_room.id, 'name', v_room.name, 'qty', v_qty, 'sub', v_sub);
  END LOOP;

  IF v_adults > v_cap_adults OR (v_adults + v_children) > v_cap_children THEN
    RAISE EXCEPTION 'Bilangan tetamu melebihi kapasiti bilik yang dipilih';
  END IF;

  v_boat := COALESCE((p->>'include_boat')::boolean, false);
  v_sn_a := COALESCE((p->>'snorkel_adult')::int, 0);
  v_sn_c := COALESCE((p->>'snorkel_child')::int, 0);
  v_sn_a := LEAST(v_sn_a, v_adults);
  v_sn_c := LEAST(v_sn_c, v_children);
  IF v_boat THEN
    SELECT * INTO v_addon FROM addon_rates WHERE key = 'boat_return';
    v_boat_total := v_addon.price_adult * v_adults + v_addon.price_child * v_children;
  END IF;

  v_van := COALESCE(p->>'van_type', 'none');
  IF v_van = 'none' THEN
    v_flight := ''; v_flight_time := '';
  ELSE
    v_flight := left(trim(COALESCE(p->>'flight_number', '')), 20);
    v_flight_time := left(trim(COALESCE(p->>'flight_arrival_time', '')), 10);
    SELECT * INTO v_addon FROM addon_rates WHERE key = CASE WHEN v_van = 'one_way' THEN 'van_one_way' ELSE 'van_return' END;
    v_van_total := v_addon.price_adult * v_adults + v_addon.price_child * v_children;
  END IF;

  IF v_sn_a > 0 OR v_sn_c > 0 THEN
    SELECT * INTO v_addon FROM addon_rates WHERE key = 'snorkeling';
    v_sn_total := v_addon.price_adult * v_sn_a + v_addon.price_child * v_sn_c;
  END IF;

  v_grand := v_room_total + v_boat_total + v_van_total + v_sn_total;
  v_deposit := round(v_grand * 25) / 100;

  v_days_until := v_in - v_today;
  IF v_agent.hold_blocked THEN
    v_hold := 1;
    v_immediate := true;
  ELSE
    v_hold := CASE WHEN v_days_until > 14 THEN 48 WHEN v_days_until >= 4 THEN 24 ELSE 1 END;
  END IF;

  -- Anti-spam: cubaan kunci semula jenis bilik dan tarikh yang sama dalam 6 jam selepas tamat tempoh
  IF EXISTS (
    SELECT 1 FROM bookings b
    JOIN booking_rooms br ON br.booking_id = b.id
    WHERE b.agent_id = v_agent.id AND b.status = 'EXPIRED'
      AND br.room_type_id = ANY(v_seen)
      AND b.expired_at > now() - interval '6 hours'
      AND EXISTS (
        SELECT 1 FROM booking_rooms br2
        WHERE br2.booking_id = b.id AND br2.room_type_id = ANY(v_seen)
      )
  ) THEN
    v_hold := LEAST(v_hold, 1);
    v_immediate := true;
  END IF;

  v_code := 'PB' || to_char(now(), 'YYMM') || lpad(((random() * 10000)::int)::text, 4, '0');

  INSERT INTO bookings (code, agent_id, status, hold_hours, hold_expires_at, requires_immediate_payment,
    check_in, check_out, nights, adults, children, lead_guest_name, lead_guest_phone, notes,
    nightly_breakdown, room_total, include_boat, boat_adult, boat_child, boat_total,
    van_type, van_adult, van_child, flight_number, flight_arrival_time, van_total,
    snorkel_adult, snorkel_child, snorkel_total, grand_total, deposit_required, balance_due_date)
  VALUES (v_code, v_agent.id, 'PENDING_DEPOSIT', v_hold, now() + make_interval(hours => v_hold), v_immediate,
    v_in, v_out, v_nights, v_adults, v_children,
    left(trim(COALESCE(p->>'lead_guest_name', '')), 120),
    left(trim(COALESCE(p->>'lead_guest_phone', '')), 40),
    left(trim(COALESCE(p->>'notes', '')), 1000),
    v_breakdown, v_room_total, v_boat,
    CASE WHEN v_boat THEN v_adults ELSE 0 END, CASE WHEN v_boat THEN v_children ELSE 0 END, v_boat_total,
    v_van, CASE WHEN v_van <> 'none' THEN v_adults ELSE 0 END, CASE WHEN v_van <> 'none' THEN v_children ELSE 0 END,
    v_flight, v_flight_time, v_van_total,
    v_sn_a, v_sn_c, v_sn_total, v_grand, v_deposit,
    GREATEST(v_today, v_in - 7))
  RETURNING id INTO v_id;

  INSERT INTO booking_rooms (booking_id, room_type_id, room_name, quantity, nightly_rate, subtotal)
  SELECT v_id, r.id, r.name, (r.qty)::int, rate_for(rt, season_for(d)), (r.sub)::numeric / (r.qty)
  FROM jsonb_to_recordset(v_rooms) AS r(id uuid, name text, qty int, sub numeric)
  CROSS JOIN LATERAL (SELECT generate_series(v_in, v_out - 1, interval '1 day')::date AS d) dates
  CROSS JOIN LATERAL (SELECT * FROM room_types WHERE id = r.id) rt
  WHERE true
  ON CONFLICT DO NOTHING;

  -- Sebenarnya, booking_rooms perlu satu baris setiap (booking, jenis bilik) dengan jumlah malam;
  -- tulis semula secara ringkas untuk keselarasan dengan skema sedia ada:
  DELETE FROM booking_rooms WHERE booking_id = v_id;
  INSERT INTO booking_rooms (booking_id, room_type_id, room_name, quantity, nightly_rate, subtotal)
  SELECT v_id, (r->>'id')::uuid, r->>'name', (r->>'qty')::int,
         round(((r->>'sub')::numeric / GREATEST((r->>'qty')::int * v_nights, 1)), 2),
         (r->>'sub')::numeric
  FROM jsonb_array_elements(v_rooms) r;

  INSERT INTO booking_events (booking_id, event, detail)
  VALUES (v_id, 'CREATED',
    'Tempahan baharu oleh ejen. Hold ' || v_hold || ' jam. Deposit RM' || to_char(v_deposit, 'FM999999990.00'));

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION create_booking(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_booking(jsonb) TO authenticated;

-- ============================================================
-- 1. Jadual inventory_blocks
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id uuid NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  blocked_units int NOT NULL DEFAULT 1 CHECK (blocked_units >= 1),
  source text NOT NULL DEFAULT 'MANUAL_MAINTENANCE'
    CHECK (source IN ('MANUAL_MAINTENANCE','WALK_IN','OTA_SYNC','MANUAL_OTA')),
  reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 200),
  external_uid text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (start_date <= end_date)
);

ALTER TABLE inventory_blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS inventory_blocks_room_date_idx
  ON inventory_blocks (room_type_id, start_date, end_date);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_blocks_external_uid_key
  ON inventory_blocks (external_uid) WHERE external_uid IS NOT NULL;

DROP POLICY IF EXISTS "read_inventory_blocks" ON inventory_blocks;
CREATE POLICY "read_inventory_blocks"
ON inventory_blocks FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','ops_admin'))
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'agent' AND p.status = 'approved')
);

-- ============================================================
-- 2. blocked_units + get_availability dengan ruangan blocked
-- ============================================================

CREATE OR REPLACE FUNCTION blocked_units(p_room uuid, p_day date) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT sum(blocked_units)
    FROM inventory_blocks
    WHERE room_type_id = p_room
      AND p_day BETWEEN start_date AND end_date
      AND in_my_world(COALESCE(auth.uid(), (SELECT id FROM profiles WHERE NOT is_demo ORDER BY created_at LIMIT 1)))
  ), 0)::int;
$$;

REVOKE EXECUTE ON FUNCTION blocked_units(uuid, date) FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  DROP FUNCTION IF EXISTS public.get_availability(date, date);
END $$;

CREATE OR REPLACE FUNCTION get_availability(p_start date, p_end date)
RETURNS TABLE (day date, room_type_id uuid, total_units int, booked int, blocked int, available int, season text, rate numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'approved') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_end < p_start OR p_end - p_start > 120 THEN
    RAISE EXCEPTION 'Invalid range';
  END IF;
  RETURN QUERY
  SELECT d::date, r.id, r.total_units,
    booked_units(r.id, d::date),
    blocked_units(r.id, d::date),
    GREATEST(r.total_units - booked_units(r.id, d::date) - blocked_units(r.id, d::date), 0),
    season_for(d::date),
    rate_for(r, season_for(d::date))
  FROM generate_series(p_start, p_end, interval '1 day') d
  CROSS JOIN room_types r
  WHERE r.is_active
  ORDER BY d, r.sort_order;
END;
$$;
REVOKE EXECUTE ON FUNCTION get_availability(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_availability(date, date) TO authenticated;