/*
# Tulis semula fungsi pembenihan demo secara eksplisit

1. Latar belakang
- `20261021045959_real_room_inventory.sql` sebelum ini menukar fungsi `demo_seed_bookings()` dan `demo_seed_history()` menggunakan manipulasi teks `replace(pg_get_functiondef(...))` terhadap slug bilik lama (garden-fan, std-ac-double, sea-view-deluxe, family-room).
- Manipulasi teks seperti itu rapuh: ia bergantung kepada jarak dan format sumber fungsi yang tepat. Jika fungsi di-format semula oleh Postgres, penggantian gagal secara senyap atau menghasilkan kod rosak.
- Migrasi ini menggantikan pendekatan itu dengan takrifan `CREATE OR REPLACE FUNCTION` yang eksplisit yang merujuk slug bilik sebenar semasa (quad-seaview, quad-hillview, dll.) secara terus, tanpa sebarang penggantian teks.

2. Perubahan
- `demo_seed_bookings()` ditulis semula secara eksplisit: contoh tempahan kini merujuk slug bilik sebenar secara terus melalui subquery `(SELECT id FROM room_types WHERE slug = '...')`.
- `demo_seed_history()` ditulis semula secara eksplisit: sejarah untuk 33 ejen demo kini dipilih dari senarai slug bilik sebenar, dengan kuantiti dihadkan kepada `total_units` bilik dan bilangan tetamu berpandukan `max_adults` / `max_children` bilik tersebut.
- Tingkah laku keseluruhan (senario status, tarikh relatif `my_today()`, aliran create_booking -> perubahan status, penanda is_demo) dikekalkan sama seperti sebelum ini.

3. Keselamatan
- Tiada perubahan pada pemberian privilege. Fungsi kekal `SECURITY DEFINER SET search_path = public`, pelaksanaan masih dikecualikan daripada `public, anon, authenticated` seperti sebelumnya.
- `reset_demo_data()` dan `demo_prepare_accounts()` yang memanggil fungsi ini tidak berubah.

4. Nota penting
- Migrasi ini selamat diulang (idempotent): `CREATE OR REPLACE FUNCTION` boleh dijalankan berulang kali.
- Selepas migrasi ini, fungsi `demo_seed_bookings()` dan `demo_seed_history()` tidak lagi mengandungi sebarang rujukan kepada slug lama (garden-fan, std-ac-double, sea-view-deluxe, family-room).
*/

-- Pemetaan slug bilik contoh yang digunakan oleh senario demo.
-- quad-seaview (unit banyak) untuk senario kumpulan, family-suite-seaview untuk keluarga,
-- superior-seaview-double untuk pasangan, quad-hillview untuk kumpulan sederhana.

CREATE OR REPLACE FUNCTION demo_seed_bookings() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent uuid; v_admin uuid; t date := my_today();
  v_old_sub text := current_setting('request.jwt.claim.sub', true);
  v_old_claims text := current_setting('request.jwt.claims', true);
  v_specs jsonb; v_spec jsonb; v_sc text; v_id uuid; v_b bookings;
  v_at timestamptz; v_dep numeric; v_bal numeric; v_rcpt text := 'demo/resit-contoh.pdf';
BEGIN
  SELECT id INTO v_agent FROM profiles WHERE is_demo AND email = 'ejen@demo.perhentianbay.my';
  SELECT id INTO v_admin FROM profiles WHERE is_demo AND email = 'admin@demo.perhentianbay.my';
  IF v_agent IS NULL OR v_admin IS NULL THEN RETURN; END IF;

  -- Senario demo, menggunakan slug bilik sebenar secara terus.
  v_specs := jsonb_build_array(
    jsonb_build_object('sc','paid','age',20,'p',jsonb_build_object(
      'check_in',t,'check_out',t+2,'adults',2,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',(SELECT id FROM room_types WHERE slug='superior-seaview-double'),'quantity',1)),
      'include_boat',true,'van_type','return','flight_number','AK6292','flight_arrival_time','10:35',
      'snorkel_adult',2,'snorkel_child',0,'lead_guest_name','Aisyah Rahman','lead_guest_phone','+60 12-345 6789',
      'notes','Pasangan bulan madu, mohon bilik menghadap laut')),
    jsonb_build_object('sc','partial','age',12,'p',jsonb_build_object(
      'check_in',t,'check_out',t+3,'adults',4,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',(SELECT id FROM room_types WHERE slug='quad-hillview'),'quantity',2)),
      'include_boat',true,'van_type','none','snorkel_adult',0,'snorkel_child',0,
      'lead_guest_name','Muhammad Hafiz','lead_guest_phone','+60 19-221 8890','notes','Kumpulan rakan pejabat')),
    jsonb_build_object('sc','partial','age',10,'p',jsonb_build_object(
      'check_in',t+1,'check_out',t+4,'adults',5,'children',2,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',(SELECT id FROM room_types WHERE slug='family-suite-seaview'),'quantity',1),jsonb_build_object('room_type_id',(SELECT id FROM room_types WHERE slug='quad-hillview'),'quantity',1)),
      'include_boat',true,'van_type','one_way','flight_number','MH1336','flight_arrival_time','08:50',
      'snorkel_adult',4,'snorkel_child',2,'lead_guest_name','Lim Wei Jie','lead_guest_phone','+60 16-778 1203',
      'notes','Keluarga dengan 2 kanak-kanak')),
    jsonb_build_object('sc','pending_receipt','age',0,'p',jsonb_build_object(
      'check_in',t+9,'check_out',t+12,'adults',4,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',(SELECT id FROM room_types WHERE slug='quad-hillview'),'quantity',2)),
      'include_boat',true,'van_type','none','snorkel_adult',4,'snorkel_child',0,
      'lead_guest_name','Nurul Izzah','lead_guest_phone','+60 11-2345 6677','notes','')),
    jsonb_build_object('sc','balance_pending','age',6,'p',jsonb_build_object(
      'check_in',t+30,'check_out',t+33,'adults',4,'children',2,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',(SELECT id FROM room_types WHERE slug='superior-seaview-double'),'quantity',2)),
      'include_boat',true,'van_type','return','flight_number','AK6290','flight_arrival_time','14:10',
      'snorkel_adult',0,'snorkel_child',0,'lead_guest_name','Tan Mei Ling','lead_guest_phone','+60 12-909 4521','notes','')),
    jsonb_build_object('sc','hold','age',0,'p',jsonb_build_object(
      'check_in',t+20,'check_out',t+22,'adults',2,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',(SELECT id FROM room_types WHERE slug='quad-hillview'),'quantity',1)),
      'include_boat',true,'van_type','none','snorkel_adult',0,'snorkel_child',0,
      'lead_guest_name','Siti Aminah','lead_guest_phone','+60 13-456 7812','notes','')),
    jsonb_build_object('sc','hold','age',0,'p',jsonb_build_object(
      'check_in',t+2,'check_out',t+4,'adults',2,'children',1,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',(SELECT id FROM room_types WHERE slug='quad-hillview'),'quantity',1)),
      'include_boat',true,'van_type','none','snorkel_adult',0,'snorkel_child',0,
      'lead_guest_name','Daniel Wong','lead_guest_phone','+60 17-622 3340','notes','Tempahan saat akhir')),
    jsonb_build_object('sc','expired','age',4,'p',jsonb_build_object(
      'check_in',t+15,'check_out',t+17,'adults',4,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',(SELECT id FROM room_types WHERE slug='family-suite-seaview'),'quantity',1)),
      'include_boat',false,'van_type','none','snorkel_adult',0,'snorkel_child',0,
      'lead_guest_name','Kumar Selvam','lead_guest_phone','+60 14-330 9087','notes','')),
    jsonb_build_object('sc','cancelled','age',8,'p',jsonb_build_object(
      'check_in',t+40,'check_out',t+43,'adults',2,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',(SELECT id FROM room_types WHERE slug='quad-hillview'),'quantity',1)),
      'include_boat',true,'van_type','none','snorkel_adult',0,'snorkel_child',0,
      'lead_guest_name','Farah Nabila','lead_guest_phone','+60 18-765 4320','notes',''))
  );

  PERFORM set_config('request.jwt.claim.sub', v_agent::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_agent, 'role', 'authenticated')::text, true);

  FOR v_spec IN SELECT * FROM jsonb_array_elements(v_specs) LOOP
    BEGIN
      v_id := create_booking(v_spec->'p');
    EXCEPTION WHEN OTHERS THEN
      v_id := NULL;
    END;
    CONTINUE WHEN v_id IS NULL;

    SELECT * INTO v_b FROM bookings WHERE id = v_id;
    v_sc := v_spec->>'sc';
    v_at := now() - make_interval(days => (v_spec->>'age')::int);
    v_dep := v_b.deposit_required;
    v_bal := v_b.grand_total - v_b.deposit_required;

    IF v_at < now() THEN
      UPDATE bookings SET created_at = v_at, updated_at = v_at,
        hold_expires_at = v_at + make_interval(hours => hold_hours) WHERE id = v_id;
      UPDATE booking_events SET created_at = v_at WHERE booking_id = v_id;
    END IF;

    IF v_sc = 'paid' OR v_sc = 'partial' OR v_sc = 'balance_pending' OR v_sc = 'pending_receipt' THEN
      PERFORM set_config('request.jwt.claim.sub', v_agent::text, true);
      PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_agent, 'role', 'authenticated')::text, true);
      PERFORM submit_payment(v_id, 'DEPOSIT_25', to_char(v_dep, 'FM999999990.00'), 'DEMO-' || upper(substr(md5(random()::text), 1, 8)), v_rcpt);
    END IF;

    IF v_sc = 'pending_receipt' THEN
      UPDATE payments SET status = 'PENDING', verified_at = NULL WHERE booking_id = v_id AND status = 'VERIFIED';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

    IF v_sc = 'paid' THEN
      PERFORM submit_payment(v_id, 'BALANCE_75', to_char(v_bal, 'FM999999990.00'), 'DEMO-' || upper(substr(md5(random()::text), 1, 8)), v_rcpt);
    ELSIF v_sc = 'balance_pending' THEN
      UPDATE bookings SET status = 'CONFIRMED_PARTIAL' WHERE id = v_id;
    ELSIF v_sc = 'hold' THEN
      NULL;
    ELSIF v_sc = 'expired' THEN
      UPDATE bookings SET status = 'EXPIRED', expired_at = v_at + make_interval(hours => hold_hours),
        hold_expires_at = v_at + make_interval(hours => hold_hours), updated_at = v_at + make_interval(hours => hold_hours)
        WHERE id = v_id;
      UPDATE profiles SET consecutive_expired = consecutive_expired + 1 WHERE id = v_agent;
    ELSIF v_sc = 'cancelled' THEN
      UPDATE bookings SET status = 'CANCELLED', cancelled_at = v_at, updated_at = v_at WHERE id = v_id;
    END IF;
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', v_old_sub, true);
  PERFORM set_config('request.jwt.claims', v_old_claims, true);
END;
$$;

REVOKE EXECUTE ON FUNCTION demo_seed_bookings() FROM public, anon, authenticated;

-- Sejarah untuk 33 ejen demo: slug bilik sebenar dipilih secara rawak dari senarai,
-- kuantiti dihadkan kepada total_units bilik dan tetamu berpandukan max_adults/max_children.

CREATE OR REPLACE FUNCTION demo_seed_history() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agents uuid[]; v_a uuid; v_rooms text[]; v_r record;
  v_room record; v_i int; v_j int; v_qty int; v_days int; v_start date; v_end date;
  v_pax int; v_old_sub text := current_setting('request.jwt.claim.sub', true);
  v_old_claims text := current_setting('request.jwt.claims', true);
  v_payload jsonb; v_id uuid;
BEGIN
  SELECT array_agg(id) INTO v_agents FROM profiles WHERE is_demo AND role = 'agent' AND id NOT IN (
    SELECT id FROM profiles WHERE is_demo AND email = 'ejen@demo.perhentianbay.my'
  );
  v_rooms := ARRAY['quad-seaview','quad-hillview','triple-seaside','superior-seaview-double','superior-seaview-twin',
    'family-suite-seaview','standard-seaside-twin','standard-seaside-double','family-suite-seaside',
    'quad-seaside','quintuple-seaside','family-premium-seaview','family-villa-seaview-a','family-villa-seaview-b'];

  FOR v_i IN 1 .. coalesce(array_length(v_agents, 1), 0) LOOP
    v_a := v_agents[v_i];
    FOR v_j IN 1 .. (2 + floor(random() * 4)::int) LOOP
      v_r := v_rooms[1 + floor(random() * array_length(v_rooms, 1))::int];
      SELECT * INTO v_room FROM room_types WHERE slug = v_r;
      CONTINUE WHEN v_room.id IS NULL;
      v_qty := LEAST(v_room.total_units, 1 + floor(random() * 2)::int);
      v_days := 1 + floor(random() * 3)::int;
      v_start := my_today() - (30 + floor(random() * 120)::int);
      v_end := v_start + v_days;
      v_pax := v_qty * GREATEST(1, v_room.max_adults - floor(random() * 2)::int);

      PERFORM set_config('request.jwt.claim.sub', v_a::text, true);
      PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);

      v_payload := jsonb_build_object(
        'check_in', v_start, 'check_out', v_end, 'adults', v_pax,
        'children', floor(random() * (v_room.max_children + 1))::int * v_qty,
        'rooms', jsonb_build_array(jsonb_build_object('room_type_id', v_room.id, 'quantity', v_qty)),
        'include_boat', random() < 0.6, 'van_type', CASE WHEN random() < 0.3 THEN 'return' WHEN random() < 0.5 THEN 'one_way' ELSE 'none' END,
        'flight_number', 'AK' || (6000 + floor(random() * 999)::int), 'flight_arrival_time', '10:30',
        'snorkel_adult', CASE WHEN random() < 0.4 THEN v_pax ELSE 0 END, 'snorkel_child', 0,
        'lead_guest_name', 'Tetamu ' || v_i || ' Agensi ' || v_j, 'lead_guest_phone', '+60 1' || (floor(random() * 9)::int) || '-555 00' || v_j, 'notes', '');

      BEGIN
        v_id := create_booking(v_payload);
      EXCEPTION WHEN OTHERS THEN
        v_id := NULL;
      END;
      CONTINUE WHEN v_id IS NULL;

      -- Sejarah yang lalu ditandakan sebagai dibayar penuh.
      UPDATE bookings SET created_at = v_start, updated_at = v_start,
        hold_expires_at = v_start::timestamptz + make_interval(hours => hold_hours) WHERE id = v_id;
      UPDATE booking_events SET created_at = v_start::timestamptz WHERE booking_id = v_id;
      PERFORM submit_payment(v_id, 'DEPOSIT_25', to_char(deposit_required, 'FM999999990.00'),
        'DEMO-' || upper(substr(md5(random()::text), 1, 8)), 'demo/resit-contoh.pdf')
        FROM bookings WHERE id = v_id;
      UPDATE payments SET status = 'VERIFIED', reviewed_at = v_start::timestamptz,
        reviewed_by = (SELECT id FROM profiles WHERE is_demo AND email = 'admin@demo.perhentianbay.my')
        WHERE booking_id = v_id AND status = 'PENDING';
      PERFORM submit_payment(v_id, 'BALANCE_75', to_char(grand_total - deposit_required, 'FM999999990.00'),
        'DEMO-' || upper(substr(md5(random()::text), 1, 8)), 'demo/resit-contoh.pdf')
        FROM bookings WHERE id = v_id;
      UPDATE bookings SET status = 'FULLY_PAID', paid_amount = grand_total WHERE id = v_id;
    END LOOP;
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', v_old_sub, true);
  PERFORM set_config('request.jwt.claims', v_old_claims, true);
END;
$$;

REVOKE EXECUTE ON FUNCTION demo_seed_history() FROM public, anon, authenticated;
