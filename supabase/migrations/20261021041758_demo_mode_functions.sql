/*
# Demo mode: seed, reset, toggle and purge

1. Config snapshot
- `take_demo_config_snapshot()` stores the real room types, seasons and add-on rates.
- Statement triggers on `room_types`, `season_ranges` and `addon_rates` refresh the snapshot whenever a NON-demo user (or the system) changes them, so the snapshot always reflects the real setup.
- `restore_demo_config()` puts the snapshot back (used by the demo reset).

2. Demo data
- `demo_prepare_profiles()` sets the fixed demo accounts (admin, agent, 2 applicants) to their starting roles and details.
- `demo_seed_bookings()` creates sample bookings for the demo agent through the normal booking engine, then moves them into every status (paid, deposit confirmed, receipt waiting review, active hold, expired, cancelled), including arrivals today and tomorrow.
- `demo_prepare_accounts()` (server only) prepares profiles and seeds if the demo has no bookings yet.

3. Callable actions
- `reset_demo_data()`: demo accounts or the real Super Admin. Wipes demo bookings only, restores pricing/seasons and reseeds.
- `set_demo_enabled(boolean)`: real Super Admin only. Turning off suspends demo accounts.
- `purge_demo_data()`: real Super Admin only. Deletes all demo accounts and their bookings and turns demo off. Real data is never touched.

4. Security
- Internal helpers are not callable by anon/authenticated.
- All actions derive the caller from auth.uid().
*/

CREATE OR REPLACE FUNCTION take_demo_config_snapshot() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO demo_config_snapshot (id, rooms, seasons, addons, taken_at)
  VALUES (1,
    COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM room_types r), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM season_ranges s), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM addon_rates a), '[]'::jsonb),
    now())
  ON CONFLICT (id) DO UPDATE SET rooms = EXCLUDED.rooms, seasons = EXCLUDED.seasons,
    addons = EXCLUDED.addons, taken_at = EXCLUDED.taken_at;
$$;

CREATE OR REPLACE FUNCTION refresh_demo_config_snapshot_trg() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT caller_is_demo() THEN PERFORM take_demo_config_snapshot(); END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS room_types_demo_snapshot ON room_types;
CREATE TRIGGER room_types_demo_snapshot AFTER INSERT OR UPDATE OR DELETE ON room_types
FOR EACH STATEMENT EXECUTE FUNCTION refresh_demo_config_snapshot_trg();
DROP TRIGGER IF EXISTS season_ranges_demo_snapshot ON season_ranges;
CREATE TRIGGER season_ranges_demo_snapshot AFTER INSERT OR UPDATE OR DELETE ON season_ranges
FOR EACH STATEMENT EXECUTE FUNCTION refresh_demo_config_snapshot_trg();
DROP TRIGGER IF EXISTS addon_rates_demo_snapshot ON addon_rates;
CREATE TRIGGER addon_rates_demo_snapshot AFTER INSERT OR UPDATE OR DELETE ON addon_rates
FOR EACH STATEMENT EXECUTE FUNCTION refresh_demo_config_snapshot_trg();

SELECT take_demo_config_snapshot();

CREATE OR REPLACE FUNCTION restore_demo_config() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s demo_config_snapshot;
BEGIN
  SELECT * INTO v_s FROM demo_config_snapshot WHERE id = 1;
  IF v_s.id IS NULL THEN RETURN; END IF;

  UPDATE room_types r SET name = x.name, description = x.description, image_url = x.image_url,
    total_units = x.total_units, max_adults = x.max_adults, max_children = x.max_children,
    rate_low_monsoon = x.rate_low_monsoon, rate_normal_weekday = x.rate_normal_weekday,
    rate_weekend = x.rate_weekend, rate_peak_holiday = x.rate_peak_holiday,
    sort_order = x.sort_order, is_active = x.is_active
  FROM jsonb_populate_recordset(NULL::room_types, v_s.rooms) x WHERE r.id = x.id;

  UPDATE addon_rates a SET name = x.name, description = x.description,
    price_adult = x.price_adult, price_child = x.price_child, sort_order = x.sort_order
  FROM jsonb_populate_recordset(NULL::addon_rates, v_s.addons) x WHERE a.key = x.key;

  DELETE FROM season_ranges WHERE true;
  INSERT INTO season_ranges SELECT * FROM jsonb_populate_recordset(NULL::season_ranges, v_s.seasons);
END;
$$;

CREATE OR REPLACE FUNCTION demo_prepare_profiles() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE profiles SET role = 'super_admin', status = 'approved', full_name = 'Demo Admin',
    company_name = 'Perhentian Bay Chalet', phone = '+60 9-697 0000', license_no = '',
    consecutive_expired = 0, hold_blocked = false
  WHERE is_demo AND email = 'admin@demo.perhentianbay.my';
  UPDATE profiles SET role = 'agent', status = 'approved', full_name = 'Demo Ejen',
    company_name = 'Agensi Demo Travel', phone = '+60 12-888 2026', license_no = 'KPK/LN 9999',
    consecutive_expired = 0, hold_blocked = false
  WHERE is_demo AND email = 'ejen@demo.perhentianbay.my';
  UPDATE profiles SET role = 'agent', status = 'pending', full_name = 'Rosli Ahmad',
    company_name = 'Pantai Timur Holidays Sdn Bhd', phone = '+60 13-912 4410', license_no = 'KPK/LN 10234',
    consecutive_expired = 0, hold_blocked = false
  WHERE is_demo AND email = 'pemohon1@demo.perhentianbay.my';
  UPDATE profiles SET role = 'agent', status = 'pending', full_name = 'Grace Tan',
    company_name = 'Island Hop Tours', phone = '+60 17-305 7781', license_no = 'KPK/LN 11870',
    consecutive_expired = 0, hold_blocked = false
  WHERE is_demo AND email = 'pemohon2@demo.perhentianbay.my';
$$;

CREATE OR REPLACE FUNCTION demo_seed_bookings() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agent uuid; v_admin uuid; t date := my_today();
  v_garden uuid; v_std uuid; v_sea uuid; v_fam uuid;
  v_old_sub text := current_setting('request.jwt.claim.sub', true);
  v_old_claims text := current_setting('request.jwt.claims', true);
  v_specs jsonb; v_spec jsonb; v_sc text; v_id uuid; v_b bookings;
  v_at timestamptz; v_dep numeric; v_bal numeric; v_rcpt text := 'demo/resit-contoh.pdf';
BEGIN
  SELECT id INTO v_agent FROM profiles WHERE is_demo AND email = 'ejen@demo.perhentianbay.my';
  SELECT id INTO v_admin FROM profiles WHERE is_demo AND email = 'admin@demo.perhentianbay.my';
  IF v_agent IS NULL OR v_admin IS NULL THEN RETURN; END IF;

  SELECT id INTO v_garden FROM room_types WHERE slug = 'garden-fan';
  SELECT id INTO v_std FROM room_types WHERE slug = 'std-ac-double';
  SELECT id INTO v_sea FROM room_types WHERE slug = 'sea-view-deluxe';
  SELECT id INTO v_fam FROM room_types WHERE slug = 'family-room';

  v_specs := jsonb_build_array(
    jsonb_build_object('sc','paid','age',20,'p',jsonb_build_object(
      'check_in',t,'check_out',t+2,'adults',2,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',v_sea,'quantity',1)),
      'include_boat',true,'van_type','return','flight_number','AK6292','flight_arrival_time','10:35',
      'snorkel_adult',2,'snorkel_child',0,'lead_guest_name','Aisyah Rahman','lead_guest_phone','+60 12-345 6789',
      'notes','Pasangan bulan madu, mohon bilik menghadap laut')),
    jsonb_build_object('sc','partial','age',12,'p',jsonb_build_object(
      'check_in',t,'check_out',t+3,'adults',4,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',v_garden,'quantity',2)),
      'include_boat',true,'van_type','none','snorkel_adult',0,'snorkel_child',0,
      'lead_guest_name','Muhammad Hafiz','lead_guest_phone','+60 19-221 8890','notes','Kumpulan rakan pejabat')),
    jsonb_build_object('sc','partial','age',10,'p',jsonb_build_object(
      'check_in',t+1,'check_out',t+4,'adults',5,'children',2,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',v_fam,'quantity',1),jsonb_build_object('room_type_id',v_std,'quantity',1)),
      'include_boat',true,'van_type','one_way','flight_number','MH1336','flight_arrival_time','08:50',
      'snorkel_adult',4,'snorkel_child',2,'lead_guest_name','Lim Wei Jie','lead_guest_phone','+60 16-778 1203',
      'notes','Keluarga dengan 2 kanak-kanak')),
    jsonb_build_object('sc','pending_receipt','age',0,'p',jsonb_build_object(
      'check_in',t+9,'check_out',t+12,'adults',4,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',v_std,'quantity',2)),
      'include_boat',true,'van_type','none','snorkel_adult',4,'snorkel_child',0,
      'lead_guest_name','Nurul Izzah','lead_guest_phone','+60 11-2345 6677','notes','')),
    jsonb_build_object('sc','balance_pending','age',6,'p',jsonb_build_object(
      'check_in',t+30,'check_out',t+33,'adults',4,'children',2,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',v_sea,'quantity',2)),
      'include_boat',true,'van_type','return','flight_number','AK6290','flight_arrival_time','14:10',
      'snorkel_adult',0,'snorkel_child',0,'lead_guest_name','Tan Mei Ling','lead_guest_phone','+60 12-909 4521','notes','')),
    jsonb_build_object('sc','hold','age',0,'p',jsonb_build_object(
      'check_in',t+20,'check_out',t+22,'adults',2,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',v_garden,'quantity',1)),
      'include_boat',true,'van_type','none','snorkel_adult',0,'snorkel_child',0,
      'lead_guest_name','Siti Aminah','lead_guest_phone','+60 13-456 7812','notes','')),
    jsonb_build_object('sc','hold','age',0,'p',jsonb_build_object(
      'check_in',t+2,'check_out',t+4,'adults',2,'children',1,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',v_std,'quantity',1)),
      'include_boat',true,'van_type','none','snorkel_adult',0,'snorkel_child',0,
      'lead_guest_name','Daniel Wong','lead_guest_phone','+60 17-622 3340','notes','Tempahan saat akhir')),
    jsonb_build_object('sc','expired','age',4,'p',jsonb_build_object(
      'check_in',t+15,'check_out',t+17,'adults',4,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',v_fam,'quantity',1)),
      'include_boat',false,'van_type','none','snorkel_adult',0,'snorkel_child',0,
      'lead_guest_name','Kumar Selvam','lead_guest_phone','+60 14-330 9087','notes','')),
    jsonb_build_object('sc','cancelled','age',8,'p',jsonb_build_object(
      'check_in',t+40,'check_out',t+43,'adults',2,'children',0,
      'rooms',jsonb_build_array(jsonb_build_object('room_type_id',v_garden,'quantity',1)),
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

    IF v_sc IN ('paid','partial','balance_pending') THEN
      INSERT INTO payments (booking_id, agent_id, kind, amount, reference, receipt_path, status, reviewed_by, reviewed_at, review_note, created_at)
      VALUES (v_id, v_agent, 'DEPOSIT_25', v_dep, 'MBB' || upper(substr(md5(random()::text), 1, 8)), v_rcpt,
        'VERIFIED', v_admin, v_at + interval '2 hours', '', v_at + interval '30 minutes');
      INSERT INTO booking_events (booking_id, actor_id, event, detail, created_at) VALUES
        (v_id, v_agent, 'PAYMENT_SUBMITTED', 'Resit deposit dimuat naik', v_at + interval '30 minutes'),
        (v_id, v_admin, 'PAYMENT_VERIFIED', 'Bayaran RM' || to_char(v_dep, 'FM999999990.00') || ' disahkan. Status: Disahkan (Deposit)', v_at + interval '2 hours');
      UPDATE bookings SET status = 'CONFIRMED_PARTIAL', paid_amount = v_dep WHERE id = v_id;
    END IF;

    IF v_sc = 'paid' AND v_bal > 0 THEN
      INSERT INTO payments (booking_id, agent_id, kind, amount, reference, receipt_path, status, reviewed_by, reviewed_at, review_note, created_at)
      VALUES (v_id, v_agent, 'BALANCE_75', v_bal, 'CIMB' || upper(substr(md5(random()::text), 1, 8)), v_rcpt,
        'VERIFIED', v_admin, now() - interval '3 days', '', now() - interval '4 days');
      INSERT INTO booking_events (booking_id, actor_id, event, detail, created_at) VALUES
        (v_id, v_agent, 'PAYMENT_SUBMITTED', 'Resit baki dimuat naik', now() - interval '4 days'),
        (v_id, v_admin, 'PAYMENT_VERIFIED', 'Bayaran RM' || to_char(v_bal, 'FM999999990.00') || ' disahkan. Status: Dibayar Penuh', now() - interval '3 days');
      UPDATE bookings SET status = 'FULLY_PAID', paid_amount = grand_total WHERE id = v_id;
    ELSIF v_sc = 'balance_pending' AND v_bal > 0 THEN
      INSERT INTO payments (booking_id, agent_id, kind, amount, reference, receipt_path, status, created_at)
      VALUES (v_id, v_agent, 'BALANCE_75', v_bal, 'PBB' || upper(substr(md5(random()::text), 1, 8)), v_rcpt, 'PENDING', now() - interval '3 hours');
      INSERT INTO booking_events (booking_id, actor_id, event, detail, created_at)
      VALUES (v_id, v_agent, 'PAYMENT_SUBMITTED', 'Resit baki dimuat naik', now() - interval '3 hours');
    ELSIF v_sc = 'pending_receipt' THEN
      INSERT INTO payments (booking_id, agent_id, kind, amount, reference, receipt_path, status, created_at)
      VALUES (v_id, v_agent, 'DEPOSIT_25', v_dep, 'MBB' || upper(substr(md5(random()::text), 1, 8)), v_rcpt, 'PENDING', now() - interval '40 minutes');
      INSERT INTO booking_events (booking_id, actor_id, event, detail, created_at)
      VALUES (v_id, v_agent, 'PAYMENT_SUBMITTED', 'Resit deposit dimuat naik', now() - interval '40 minutes');
    ELSIF v_sc = 'expired' THEN
      UPDATE bookings SET status = 'EXPIRED', expired_at = v_at + make_interval(hours => hold_hours) WHERE id = v_id;
      INSERT INTO booking_events (booking_id, actor_id, event, detail, created_at)
      VALUES (v_id, NULL, 'EXPIRED', 'Tempoh hold tamat tanpa bayaran deposit. Bilik dilepaskan.', v_at + make_interval(hours => v_b.hold_hours));
    ELSIF v_sc = 'cancelled' THEN
      UPDATE bookings SET status = 'CANCELLED', cancelled_at = v_at + interval '1 day',
        cancel_reason = 'Tetamu menukar tarikh percutian' WHERE id = v_id;
      INSERT INTO booking_events (booking_id, actor_id, event, detail, created_at)
      VALUES (v_id, v_agent, 'CANCELLED', 'Dibatalkan: Tetamu menukar tarikh percutian', v_at + interval '1 day');
    END IF;
  END LOOP;

  PERFORM set_config('request.jwt.claim.sub', COALESCE(v_old_sub, ''), true);
  PERFORM set_config('request.jwt.claims', COALESCE(v_old_claims, ''), true);
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
END;
$$;

CREATE OR REPLACE FUNCTION set_demo_enabled(p_enabled boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_super_admin() OR caller_is_demo() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE app_settings SET demo_enabled = COALESCE(p_enabled, false), updated_at = now() WHERE id = 1;
  IF COALESCE(p_enabled, false) THEN
    PERFORM demo_prepare_profiles();
  ELSE
    UPDATE profiles SET status = 'suspended' WHERE is_demo;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION purge_demo_data() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT is_super_admin() OR caller_is_demo() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE app_settings SET demo_enabled = false, updated_at = now() WHERE id = 1;
  DELETE FROM bookings WHERE agent_id IN (SELECT id FROM public.profiles WHERE is_demo);
  DELETE FROM booking_events WHERE actor_id IN (SELECT id FROM public.profiles WHERE is_demo);
  DELETE FROM auth.users WHERE id IN (SELECT id FROM public.profiles WHERE is_demo);
END;
$$;

REVOKE EXECUTE ON FUNCTION take_demo_config_snapshot() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION refresh_demo_config_snapshot_trg() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION restore_demo_config() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION demo_prepare_profiles() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION demo_seed_bookings() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION demo_prepare_accounts() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION demo_prepare_accounts() TO service_role;
REVOKE EXECUTE ON FUNCTION reset_demo_data() FROM public, anon;
REVOKE EXECUTE ON FUNCTION set_demo_enabled(boolean) FROM public, anon;
REVOKE EXECUTE ON FUNCTION purge_demo_data() FROM public, anon;
GRANT EXECUTE ON FUNCTION reset_demo_data() TO authenticated;
GRANT EXECUTE ON FUNCTION set_demo_enabled(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION purge_demo_data() TO authenticated;
