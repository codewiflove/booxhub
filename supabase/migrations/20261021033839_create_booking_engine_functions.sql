/*
# Booking engine functions

Plain-English: All booking rules run on the server so agents can never set prices or statuses themselves.

1. Functions
- `season_for(date)` - season of a night (admin ranges first, otherwise Fri/Sat nights = WEEKEND).
- `get_availability(start, end)` - per-night availability, season and rate for every active room type.
- `create_booking(payload)` - validates, locks inventory, computes nett price + add-ons, applies dynamic
  hold (48h / 24h / 1h), anti-spam rule, 25% deposit, balance due date (7 days before check-in).
- `submit_payment(booking, kind, reference, receipt_path)` - agent submits a manual receipt; amount is
  computed by the server.
- `review_payment(payment, approve, note)` - staff verify/reject; verified payments move the booking to
  CONFIRMED_PARTIAL or FULLY_PAID.
- `cancel_booking(booking, reason)` - agent may release own pending hold; super admin may cancel any.
- `extend_hold(booking, hours)` - super admin override.
- `admin_update_agent(user, status, role, hold_blocked)` - super admin manages accounts.
- `expire_holds()` - marks unpaid expired holds as EXPIRED, returns rooms, updates anti-spam counters.

2. Scheduling
- pg_cron job `auto-unlock-expired` runs `expire_holds()` every 15 minutes.

3. Security
- All functions are SECURITY DEFINER with fixed search_path, check the caller via auth.uid(),
  and are not executable by anon. `expire_holds` is not executable by any client role.

4. Notes
1. A pending hold with a receipt awaiting review keeps its rooms until staff review it.
2. Availability ignores pending holds whose timer has passed, so rooms reopen instantly even before the job runs.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION my_today() RETURNS date
LANGUAGE sql STABLE AS $$ SELECT (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date $$;

CREATE OR REPLACE FUNCTION season_for(p_day date) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT season_type FROM season_ranges
      WHERE p_day BETWEEN start_date AND end_date
      ORDER BY CASE season_type WHEN 'PEAK_HOLIDAY' THEN 1 WHEN 'LOW_MONSOON' THEN 2
        WHEN 'WEEKEND' THEN 3 ELSE 4 END, created_at DESC
      LIMIT 1),
    CASE WHEN extract(isodow FROM p_day) IN (5,6) THEN 'WEEKEND' ELSE 'NORMAL_WEEKDAY' END
  );
$$;

CREATE OR REPLACE FUNCTION rate_for(r room_types, p_season text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_season
    WHEN 'LOW_MONSOON' THEN r.rate_low_monsoon
    WHEN 'WEEKEND' THEN r.rate_weekend
    WHEN 'PEAK_HOLIDAY' THEN r.rate_peak_holiday
    ELSE r.rate_normal_weekday END;
$$;

CREATE OR REPLACE FUNCTION booked_units(p_room uuid, p_day date) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(br.quantity), 0)::int
  FROM booking_rooms br JOIN bookings b ON b.id = br.booking_id
  WHERE br.room_type_id = p_room
    AND p_day >= b.check_in AND p_day < b.check_out
    AND (b.status IN ('CONFIRMED_PARTIAL','FULLY_PAID')
      OR (b.status = 'PENDING_DEPOSIT' AND (b.hold_expires_at > now()
        OR EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status = 'PENDING'))));
$$;
REVOKE EXECUTE ON FUNCTION booked_units(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION get_availability(p_start date, p_end date)
RETURNS TABLE (day date, room_type_id uuid, total_units int, booked int, available int, season text, rate numeric)
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
    GREATEST(r.total_units - booked_units(r.id, d::date), 0),
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

CREATE OR REPLACE FUNCTION log_booking_event(p_booking uuid, p_event text, p_detail text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO booking_events (booking_id, actor_id, event, detail) VALUES (p_booking, auth.uid(), p_event, p_detail);
$$;
REVOKE EXECUTE ON FUNCTION log_booking_event(uuid, text, text) FROM PUBLIC, anon, authenticated;

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
      v_avail := v_room.total_units - booked_units(v_room.id, v_day);
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
  IF v_boat THEN
    SELECT * INTO v_addon FROM addon_rates WHERE key = 'boat_return';
    v_boat_total := v_addon.price_adult * v_adults + v_addon.price_child * v_children;
  END IF;

  v_van := COALESCE(p->>'van_type', 'none');
  IF v_van NOT IN ('none','one_way','return') THEN RAISE EXCEPTION 'Pilihan van tidak sah'; END IF;
  v_flight := left(trim(COALESCE(p->>'flight_number', '')), 20);
  v_flight_time := left(trim(COALESCE(p->>'flight_arrival_time', '')), 40);
  IF v_van <> 'none' THEN
    SELECT * INTO v_addon FROM addon_rates WHERE key = CASE v_van WHEN 'one_way' THEN 'van_one_way' ELSE 'van_return' END;
    v_van_total := v_addon.price_adult * v_adults + v_addon.price_child * v_children;
  ELSE
    v_flight := ''; v_flight_time := '';
  END IF;

  v_sn_a := COALESCE((p->>'snorkel_adult')::int, 0);
  v_sn_c := COALESCE((p->>'snorkel_child')::int, 0);
  IF v_sn_a < 0 OR v_sn_c < 0 OR v_sn_a > v_adults OR v_sn_c > v_children THEN
    RAISE EXCEPTION 'Bilangan peserta snorkeling tidak sah';
  END IF;
  IF v_sn_a + v_sn_c > 0 THEN
    SELECT * INTO v_addon FROM addon_rates WHERE key = 'snorkeling';
    v_sn_total := v_addon.price_adult * v_sn_a + v_addon.price_child * v_sn_c;
  END IF;

  v_grand := v_room_total + v_boat_total + v_van_total + v_sn_total;
  v_deposit := round(v_grand * 0.25, 2);

  v_days_until := v_in - v_today;
  v_hold := CASE WHEN v_days_until > 14 THEN 48 WHEN v_days_until >= 4 THEN 24 ELSE 1 END;

  IF v_agent.hold_blocked OR EXISTS (
    SELECT 1 FROM bookings b JOIN booking_rooms br ON br.booking_id = b.id
    WHERE b.agent_id = v_agent.id AND b.status = 'EXPIRED'
      AND b.expired_at > now() - interval '6 hours'
      AND b.check_in = v_in AND b.check_out = v_out
      AND br.room_type_id = ANY(v_seen)
  ) THEN
    v_immediate := true;
    v_hold := 1;
  END IF;

  LOOP
    v_code := 'PBC-' || to_char(v_today, 'YYMM') || '-' || lpad((floor(random() * 10000))::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM bookings WHERE code = v_code);
  END LOOP;

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
    v_sn_a, v_sn_c, v_sn_total, v_grand, v_deposit, GREATEST(v_today, v_in - 7))
  RETURNING id INTO v_id;

  INSERT INTO booking_rooms (booking_id, room_type_id, room_name, quantity, subtotal)
  SELECT v_id, (r->>'id')::uuid, r->>'name', (r->>'qty')::int, (r->>'sub')::numeric
  FROM jsonb_array_elements(v_rooms) r;

  PERFORM log_booking_event(v_id, 'CREATED',
    'Tempahan dibuat. Bilik dikunci selama ' || v_hold || ' jam' ||
    CASE WHEN v_immediate THEN ' (bayaran segera diwajibkan)' ELSE '' END);
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION create_booking(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_booking(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION submit_payment(p_booking uuid, p_kind text, p_reference text, p_receipt_path text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_b bookings; v_amount numeric; v_id uuid;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking FOR UPDATE;
  IF v_b.id IS NULL OR v_b.agent_id <> auth.uid() THEN RAISE EXCEPTION 'Tempahan tidak dijumpai'; END IF;
  IF p_kind NOT IN ('DEPOSIT_25','BALANCE_75','FULL_100') THEN RAISE EXCEPTION 'Jenis bayaran tidak sah'; END IF;
  IF length(trim(COALESCE(p_reference, ''))) < 3 OR length(p_reference) > 100 THEN
    RAISE EXCEPTION 'No. rujukan bayaran diperlukan';
  END IF;
  IF COALESCE(p_receipt_path, '') = '' OR split_part(p_receipt_path, '/', 1) <> auth.uid()::text THEN
    RAISE EXCEPTION 'Resit bayaran diperlukan';
  END IF;
  IF EXISTS (SELECT 1 FROM payments WHERE booking_id = p_booking AND status = 'PENDING') THEN
    RAISE EXCEPTION 'Terdapat bayaran yang sedang disemak';
  END IF;

  IF p_kind IN ('DEPOSIT_25','FULL_100') THEN
    IF v_b.status <> 'PENDING_DEPOSIT' OR v_b.hold_expires_at <= now() THEN
      RAISE EXCEPTION 'Tempoh hold telah tamat';
    END IF;
    v_amount := CASE WHEN p_kind = 'DEPOSIT_25' THEN v_b.deposit_required ELSE v_b.grand_total END;
  ELSE
    IF v_b.status <> 'CONFIRMED_PARTIAL' THEN RAISE EXCEPTION 'Baki hanya boleh dibayar selepas deposit disahkan'; END IF;
    v_amount := v_b.grand_total - v_b.paid_amount;
  END IF;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Tiada jumlah perlu dibayar'; END IF;

  INSERT INTO payments (booking_id, agent_id, kind, method, amount, reference, receipt_path)
  VALUES (p_booking, auth.uid(), p_kind, 'MANUAL_RECEIPT', v_amount, trim(p_reference), p_receipt_path)
  RETURNING id INTO v_id;

  PERFORM log_booking_event(p_booking, 'PAYMENT_SUBMITTED',
    'Resit bayaran RM' || to_char(v_amount, 'FM999999990.00') || ' dihantar untuk semakan');
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION submit_payment(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION submit_payment(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION review_payment(p_payment uuid, p_approve boolean, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p payments; v_b bookings; v_paid numeric;
BEGIN
  IF NOT is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE payments SET status = CASE WHEN p_approve THEN 'VERIFIED' ELSE 'REJECTED' END,
    reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(COALESCE(p_note, ''), 500)
  WHERE id = p_payment AND status = 'PENDING'
  RETURNING * INTO v_p;
  IF v_p.id IS NULL THEN RAISE EXCEPTION 'Bayaran sudah disemak'; END IF;

  SELECT * INTO v_b FROM bookings WHERE id = v_p.booking_id FOR UPDATE;
  IF NOT p_approve THEN
    PERFORM log_booking_event(v_b.id, 'PAYMENT_REJECTED', 'Resit ditolak' ||
      CASE WHEN COALESCE(p_note, '') <> '' THEN ': ' || p_note ELSE '' END);
    RETURN;
  END IF;

  IF v_b.status IN ('EXPIRED','CANCELLED') THEN
    RAISE EXCEPTION 'Tempahan ini sudah tidak aktif';
  END IF;

  v_paid := v_b.paid_amount + v_p.amount;
  UPDATE bookings SET paid_amount = v_paid,
    status = CASE WHEN v_paid >= grand_total THEN 'FULLY_PAID' ELSE 'CONFIRMED_PARTIAL' END,
    updated_at = now()
  WHERE id = v_b.id;
  UPDATE profiles SET consecutive_expired = 0 WHERE id = v_b.agent_id;

  PERFORM log_booking_event(v_b.id, 'PAYMENT_VERIFIED',
    'Bayaran RM' || to_char(v_p.amount, 'FM999999990.00') || ' disahkan. Status: ' ||
    CASE WHEN v_paid >= v_b.grand_total THEN 'Dibayar Penuh' ELSE 'Disahkan (Deposit)' END);
END;
$$;
REVOKE EXECUTE ON FUNCTION review_payment(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION review_payment(uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION cancel_booking(p_booking uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_b bookings;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking FOR UPDATE;
  IF v_b.id IS NULL THEN RAISE EXCEPTION 'Tempahan tidak dijumpai'; END IF;
  IF is_super_admin() THEN
    IF v_b.status NOT IN ('PENDING_DEPOSIT','CONFIRMED_PARTIAL','FULLY_PAID') THEN
      RAISE EXCEPTION 'Tempahan sudah tidak aktif';
    END IF;
  ELSIF v_b.agent_id = auth.uid() THEN
    IF v_b.status <> 'PENDING_DEPOSIT' THEN
      RAISE EXCEPTION 'Hanya tempahan yang belum berbayar boleh dilepaskan';
    END IF;
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE bookings SET status = 'CANCELLED', cancelled_at = now(),
    cancel_reason = left(COALESCE(p_reason, ''), 500), updated_at = now()
  WHERE id = p_booking;
  UPDATE payments SET status = 'REJECTED', reviewed_by = auth.uid(), reviewed_at = now(),
    review_note = 'Tempahan dibatalkan'
  WHERE booking_id = p_booking AND status = 'PENDING';
  PERFORM log_booking_event(p_booking, 'CANCELLED', 'Tempahan dibatalkan' ||
    CASE WHEN COALESCE(p_reason, '') <> '' THEN ': ' || p_reason ELSE '' END);
END;
$$;
REVOKE EXECUTE ON FUNCTION cancel_booking(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION cancel_booking(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION extend_hold(p_booking uuid, p_hours int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_b bookings;
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 168 THEN RAISE EXCEPTION 'Tempoh tidak sah'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking FOR UPDATE;
  IF v_b.id IS NULL OR v_b.status <> 'PENDING_DEPOSIT' THEN
    RAISE EXCEPTION 'Hanya tempahan menunggu deposit boleh dilanjutkan';
  END IF;
  IF v_b.hold_expires_at <= now() AND NOT EXISTS (
    SELECT 1 FROM payments WHERE booking_id = p_booking AND status = 'PENDING') THEN
    RAISE EXCEPTION 'Tempoh hold sudah tamat';
  END IF;
  UPDATE bookings SET hold_expires_at = GREATEST(hold_expires_at, now()) + make_interval(hours => p_hours),
    updated_at = now() WHERE id = p_booking;
  PERFORM log_booking_event(p_booking, 'HOLD_EXTENDED', 'Tempoh hold dilanjutkan ' || p_hours || ' jam oleh pengurus');
END;
$$;
REVOKE EXECUTE ON FUNCTION extend_hold(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION extend_hold(uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION admin_update_agent(p_user uuid, p_status text, p_role text, p_hold_blocked boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_super_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'Anda tidak boleh mengubah akaun sendiri'; END IF;
  IF p_status NOT IN ('pending','approved','suspended') OR p_role NOT IN ('super_admin','ops_admin','agent') THEN
    RAISE EXCEPTION 'Nilai tidak sah';
  END IF;
  UPDATE profiles SET status = p_status, role = p_role, hold_blocked = COALESCE(p_hold_blocked, false),
    consecutive_expired = CASE WHEN COALESCE(p_hold_blocked, false) THEN consecutive_expired ELSE 0 END
  WHERE id = p_user;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_update_agent(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_update_agent(uuid, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION expire_holds() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row record; v_count int := 0;
BEGIN
  FOR v_row IN
    UPDATE bookings b SET status = 'EXPIRED', expired_at = now(), updated_at = now()
    WHERE b.status = 'PENDING_DEPOSIT' AND b.hold_expires_at <= now()
      AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status = 'PENDING')
    RETURNING b.id, b.agent_id
  LOOP
    v_count := v_count + 1;
    INSERT INTO booking_events (booking_id, event, detail)
    VALUES (v_row.id, 'EXPIRED', 'Deposit tidak diterima dalam tempoh hold. Bilik dilepaskan secara automatik.');
    UPDATE profiles SET consecutive_expired = consecutive_expired + 1,
      hold_blocked = hold_blocked OR consecutive_expired + 1 >= 3
    WHERE id = v_row.agent_id;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION expire_holds() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION season_for(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION season_for(date) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-unlock-expired') THEN
    PERFORM cron.unschedule('auto-unlock-expired');
  END IF;
  PERFORM cron.schedule('auto-unlock-expired', '*/15 * * * *', 'SELECT public.expire_holds();');
END $$;
