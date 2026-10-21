/*
# Demo mode: flag, settings and data isolation

1. Modified Tables
- `profiles.is_demo` (boolean, default false): marks the built-in demo accounts.

2. New Tables
- `app_settings` (single row): `demo_enabled` controls whether demo login is offered. Readable by everyone (it is only a public on/off flag).
- `demo_config_snapshot` (single row, private): last real copy of room types, seasons and add-on rates so the demo reset can restore pricing.

3. Isolation ("two worlds")
- Helper functions `caller_is_demo()`, `profile_is_demo()`, `in_my_world()`.
- Staff read policies on bookings, payments, booking_rooms, booking_events and profiles now only show rows from the caller's world: demo staff see only demo data, real staff see only real data.
- Guard triggers on bookings, payments and profiles block any demo account from inserting, changing or deleting real records, whatever path is used.
- `booked_units` (availability) only counts bookings from the caller's world.
- Demo admins cannot add or delete room types; receipt files are readable by demo staff only for demo folders.
- `handle_new_user`: demo accounts never take the "first account becomes Super Admin" slot.

4. Notes
1. Existing data is untouched; all current profiles stay non-demo.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS profiles_is_demo_idx ON profiles (is_demo) WHERE is_demo;

CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  demo_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_settings FROM anon, authenticated;
GRANT SELECT ON app_settings TO anon, authenticated;
DROP POLICY IF EXISTS "app_settings_public_read" ON app_settings;
CREATE POLICY "app_settings_public_read" ON app_settings FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS demo_config_snapshot (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  rooms jsonb NOT NULL DEFAULT '[]'::jsonb,
  seasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  addons jsonb NOT NULL DEFAULT '[]'::jsonb,
  taken_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE demo_config_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON demo_config_snapshot FROM anon, authenticated;

CREATE OR REPLACE FUNCTION caller_is_demo() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_demo FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION profile_is_demo(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_demo FROM profiles WHERE id = p_user), false);
$$;

CREATE OR REPLACE FUNCTION in_my_world(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT profile_is_demo(p_user) = caller_is_demo();
$$;

CREATE OR REPLACE FUNCTION storage_folder_visible_to_demo(p_folder text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_folder = 'demo' OR EXISTS (SELECT 1 FROM profiles WHERE id::text = p_folder AND is_demo);
$$;

REVOKE EXECUTE ON FUNCTION caller_is_demo() FROM public, anon;
REVOKE EXECUTE ON FUNCTION profile_is_demo(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION in_my_world(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION storage_folder_visible_to_demo(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION caller_is_demo() TO authenticated;
GRANT EXECUTE ON FUNCTION profile_is_demo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION in_my_world(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION storage_folder_visible_to_demo(text) TO authenticated;

DROP POLICY IF EXISTS "bookings_select_own_or_staff" ON bookings;
CREATE POLICY "bookings_select_own_or_staff" ON bookings FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR (is_staff() AND in_my_world(agent_id)));

DROP POLICY IF EXISTS "payments_select_own_or_staff" ON payments;
CREATE POLICY "payments_select_own_or_staff" ON payments FOR SELECT TO authenticated
USING (agent_id = auth.uid() OR (is_staff() AND in_my_world(agent_id)));

DROP POLICY IF EXISTS "booking_rooms_select_own_or_staff" ON booking_rooms;
CREATE POLICY "booking_rooms_select_own_or_staff" ON booking_rooms FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_rooms.booking_id
  AND (b.agent_id = auth.uid() OR (is_staff() AND in_my_world(b.agent_id)))));

DROP POLICY IF EXISTS "booking_events_select_own_or_staff" ON booking_events;
CREATE POLICY "booking_events_select_own_or_staff" ON booking_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM bookings b WHERE b.id = booking_events.booking_id
  AND (b.agent_id = auth.uid() OR (is_staff() AND in_my_world(b.agent_id)))));

DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON profiles;
CREATE POLICY "profiles_select_own_or_staff" ON profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR (is_staff() AND is_demo = caller_is_demo()));

DROP POLICY IF EXISTS "room_types_insert_super_admin" ON room_types;
CREATE POLICY "room_types_insert_super_admin" ON room_types FOR INSERT TO authenticated
WITH CHECK (is_super_admin() AND NOT caller_is_demo());

DROP POLICY IF EXISTS "room_types_delete_super_admin" ON room_types;
CREATE POLICY "room_types_delete_super_admin" ON room_types FOR DELETE TO authenticated
USING (is_super_admin() AND NOT caller_is_demo());

DROP POLICY IF EXISTS "receipts_select_own_or_staff" ON storage.objects;
CREATE POLICY "receipts_select_own_or_staff" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'receipts' AND (
  (storage.foldername(name))[1] = auth.uid()::text
  OR (is_staff() AND (NOT caller_is_demo() OR storage_folder_visible_to_demo((storage.foldername(name))[1])))
));

CREATE OR REPLACE FUNCTION guard_demo_agent_rows() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF caller_is_demo() THEN
    IF TG_OP IN ('UPDATE','DELETE') AND NOT profile_is_demo(OLD.agent_id) THEN
      RAISE EXCEPTION 'Akaun demo tidak boleh mengubah data sebenar';
    END IF;
    IF TG_OP IN ('INSERT','UPDATE') AND NOT profile_is_demo(NEW.agent_id) THEN
      RAISE EXCEPTION 'Akaun demo tidak boleh mengubah data sebenar';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION guard_demo_profile_rows() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF caller_is_demo() AND NOT OLD.is_demo THEN
    RAISE EXCEPTION 'Akaun demo tidak boleh mengubah data sebenar';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.is_demo IS DISTINCT FROM OLD.is_demo AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION guard_demo_agent_rows() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION guard_demo_profile_rows() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS bookings_guard_demo ON bookings;
CREATE TRIGGER bookings_guard_demo BEFORE INSERT OR UPDATE OR DELETE ON bookings
FOR EACH ROW EXECUTE FUNCTION guard_demo_agent_rows();

DROP TRIGGER IF EXISTS payments_guard_demo ON payments;
CREATE TRIGGER payments_guard_demo BEFORE INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION guard_demo_agent_rows();

DROP TRIGGER IF EXISTS profiles_guard_demo ON profiles;
CREATE TRIGGER profiles_guard_demo BEFORE UPDATE OR DELETE ON profiles
FOR EACH ROW EXECUTE FUNCTION guard_demo_profile_rows();

CREATE OR REPLACE FUNCTION public.booked_units(p_room uuid, p_day date)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
SELECT COALESCE(SUM(br.quantity), 0)::int
FROM booking_rooms br
JOIN bookings b ON b.id = br.booking_id
JOIN profiles pr ON pr.id = b.agent_id
WHERE br.room_type_id = p_room
AND pr.is_demo = caller_is_demo()
AND p_day >= b.check_in AND p_day < b.check_out
AND (b.status IN ('CONFIRMED_PARTIAL','FULLY_PAID')
OR (b.status = 'PENDING_DEPOSIT' AND (b.hold_expires_at > now()
OR EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status = 'PENDING'))));
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
v_first boolean := false;
v_demo boolean := COALESCE((NEW.raw_app_meta_data->>'demo')::boolean, false);
BEGIN
PERFORM pg_advisory_xact_lock(hashtext('profiles_first_admin'));
IF NOT v_demo THEN
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin' AND NOT is_demo) INTO v_first;
END IF;
INSERT INTO profiles (id, email, full_name, company_name, phone, license_no, role, status, is_demo)
VALUES (
NEW.id,
COALESCE(NEW.email, ''),
left(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 120),
left(COALESCE(NEW.raw_user_meta_data->>'company_name', ''), 160),
left(COALESCE(NEW.raw_user_meta_data->>'phone', ''), 40),
left(COALESCE(NEW.raw_user_meta_data->>'license_no', ''), 60),
CASE WHEN v_first THEN 'super_admin' ELSE 'agent' END,
CASE WHEN v_first THEN 'approved' ELSE 'pending' END,
v_demo
)
ON CONFLICT (id) DO NOTHING;
RETURN NEW;
END;
$function$;
