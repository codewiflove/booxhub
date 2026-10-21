/*
# B2B Portal core schema

Plain-English: Creates everything the Perhentian Bay Chalet B2B portal stores: user profiles with roles,
the room catalogue and fixed agent nett rates, the seasonal calendar, add-on rates (boat, van, snorkeling),
bookings with their rooms, payments (manual receipts) and an audit trail of booking events.

1. New Tables
- `profiles` - one row per account: contact & agency details, `role` (super_admin / ops_admin / agent),
  `status` (pending / approved / suspended), anti-spam counters (`consecutive_expired`, `hold_blocked`).
- `room_types` - room catalogue: units, capacity and 4 seasonal nett rates.
- `season_ranges` - date ranges marked LOW_MONSOON / NORMAL_WEEKDAY / WEEKEND / PEAK_HOLIDAY.
- `addon_rates` - fixed add-on prices keyed by `key` (boat_return, van_one_way, van_return, snorkeling).
- `bookings` - booking header: dates, hold timer, add-ons, totals, deposit, paid amount, status.
- `booking_rooms` - rooms in each booking with server-computed subtotal.
- `payments` - payment submissions (deposit 25%, balance 75%, full 100%) and their review state.
- `booking_events` - timeline / audit log per booking.

2. Security
- RLS enabled on every table.
- Agents read only their own profile, bookings, rooms, payments and events. Staff read all.
- Catalogue tables readable by signed-in users; writable only by super admins.
- bookings / booking_rooms / payments / booking_events have NO client write policies: all writes go
  through checked server functions (next migration), so prices and status can never be set by a client.
- profiles: users may only update their own contact columns (column-level grant); role, status and
  anti-spam fields are server-controlled.
- Private storage bucket `receipts` (5MB, images/PDF), files stored under the uploader's own folder.

3. Notes
1. The first account ever created becomes the approved Super Admin; everyone after starts as a pending agent.
2. Sample room types, add-on rates and seasons are seeded and can be edited in the admin panel.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  license_no text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'agent' CHECK (role IN ('super_admin','ops_admin','agent')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  consecutive_expired int NOT NULL DEFAULT 0,
  hold_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  total_units int NOT NULL DEFAULT 1 CHECK (total_units >= 0),
  max_adults int NOT NULL DEFAULT 2 CHECK (max_adults >= 1),
  max_children int NOT NULL DEFAULT 0 CHECK (max_children >= 0),
  rate_low_monsoon numeric(10,2) NOT NULL DEFAULT 0 CHECK (rate_low_monsoon >= 0),
  rate_normal_weekday numeric(10,2) NOT NULL DEFAULT 0 CHECK (rate_normal_weekday >= 0),
  rate_weekend numeric(10,2) NOT NULL DEFAULT 0 CHECK (rate_weekend >= 0),
  rate_peak_holiday numeric(10,2) NOT NULL DEFAULT 0 CHECK (rate_peak_holiday >= 0),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS season_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL DEFAULT '',
  season_type text NOT NULL CHECK (season_type IN ('LOW_MONSOON','NORMAL_WEEKDAY','WEEKEND','PEAK_HOLIDAY')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS season_ranges_dates_idx ON season_ranges (start_date, end_date);

CREATE TABLE IF NOT EXISTS addon_rates (
  key text PRIMARY KEY CHECK (key IN ('boat_return','van_one_way','van_return','snorkeling')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_adult numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_adult >= 0),
  price_child numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_child >= 0),
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  agent_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING_DEPOSIT'
    CHECK (status IN ('PENDING_DEPOSIT','CONFIRMED_PARTIAL','FULLY_PAID','EXPIRED','CANCELLED')),
  hold_hours int NOT NULL,
  hold_expires_at timestamptz NOT NULL,
  requires_immediate_payment boolean NOT NULL DEFAULT false,
  check_in date NOT NULL,
  check_out date NOT NULL,
  nights int NOT NULL,
  adults int NOT NULL,
  children int NOT NULL DEFAULT 0,
  lead_guest_name text NOT NULL DEFAULT '',
  lead_guest_phone text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  nightly_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  room_total numeric(10,2) NOT NULL DEFAULT 0,
  include_boat boolean NOT NULL DEFAULT false,
  boat_adult int NOT NULL DEFAULT 0,
  boat_child int NOT NULL DEFAULT 0,
  boat_total numeric(10,2) NOT NULL DEFAULT 0,
  van_type text NOT NULL DEFAULT 'none' CHECK (van_type IN ('none','one_way','return')),
  van_adult int NOT NULL DEFAULT 0,
  van_child int NOT NULL DEFAULT 0,
  flight_number text NOT NULL DEFAULT '',
  flight_arrival_time text NOT NULL DEFAULT '',
  van_total numeric(10,2) NOT NULL DEFAULT 0,
  snorkel_adult int NOT NULL DEFAULT 0,
  snorkel_child int NOT NULL DEFAULT 0,
  snorkel_total numeric(10,2) NOT NULL DEFAULT 0,
  grand_total numeric(10,2) NOT NULL DEFAULT 0,
  deposit_required numeric(10,2) NOT NULL DEFAULT 0,
  paid_amount numeric(10,2) NOT NULL DEFAULT 0,
  balance_due_date date NOT NULL,
  expired_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_agent_idx ON bookings (agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status, hold_expires_at);
CREATE INDEX IF NOT EXISTS bookings_dates_idx ON bookings (check_in, check_out);

CREATE TABLE IF NOT EXISTS booking_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_type_id uuid NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
  room_name text NOT NULL,
  quantity int NOT NULL CHECK (quantity > 0),
  subtotal numeric(10,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS booking_rooms_booking_idx ON booking_rooms (booking_id);
CREATE INDEX IF NOT EXISTS booking_rooms_room_idx ON booking_rooms (room_type_id);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('DEPOSIT_25','BALANCE_75','FULL_100')),
  method text NOT NULL DEFAULT 'MANUAL_RECEIPT' CHECK (method IN ('MANUAL_RECEIPT','FPX_BAYARCASH')),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  reference text NOT NULL DEFAULT '',
  receipt_path text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','VERIFIED','REJECTED')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  review_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments (booking_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status, created_at);

CREATE TABLE IF NOT EXISTS booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES profiles(id),
  event text NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_events_booking_idx ON booking_events (booking_id, created_at);

-- Role helpers
CREATE OR REPLACE FUNCTION is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role IN ('super_admin','ops_admin') AND status = 'approved');
$$;

CREATE OR REPLACE FUNCTION is_super_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()
    AND role = 'super_admin' AND status = 'approved');
$$;

REVOKE EXECUTE ON FUNCTION is_staff() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;

-- New user -> profile
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_first boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('profiles_first_admin'));
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin') INTO v_first;
  INSERT INTO profiles (id, email, full_name, company_name, phone, license_no, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    left(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 120),
    left(COALESCE(NEW.raw_user_meta_data->>'company_name', ''), 160),
    left(COALESCE(NEW.raw_user_meta_data->>'phone', ''), 40),
    left(COALESCE(NEW.raw_user_meta_data->>'license_no', ''), 60),
    CASE WHEN v_first THEN 'super_admin' ELSE 'agent' END,
    CASE WHEN v_first THEN 'approved' ELSE 'pending' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON profiles;
CREATE POLICY "profiles_select_own_or_staff" ON profiles FOR SELECT
  TO authenticated USING (id = auth.uid() OR is_staff());
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON profiles FROM anon, authenticated;
GRANT UPDATE (full_name, company_name, phone, license_no) ON profiles TO authenticated;

-- room_types
DROP POLICY IF EXISTS "room_types_select_signed_in" ON room_types;
CREATE POLICY "room_types_select_signed_in" ON room_types FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "room_types_insert_super_admin" ON room_types;
CREATE POLICY "room_types_insert_super_admin" ON room_types FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS "room_types_update_super_admin" ON room_types;
CREATE POLICY "room_types_update_super_admin" ON room_types FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS "room_types_delete_super_admin" ON room_types;
CREATE POLICY "room_types_delete_super_admin" ON room_types FOR DELETE
  TO authenticated USING (is_super_admin());

-- season_ranges
DROP POLICY IF EXISTS "season_ranges_select_signed_in" ON season_ranges;
CREATE POLICY "season_ranges_select_signed_in" ON season_ranges FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "season_ranges_insert_super_admin" ON season_ranges;
CREATE POLICY "season_ranges_insert_super_admin" ON season_ranges FOR INSERT
  TO authenticated WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS "season_ranges_update_super_admin" ON season_ranges;
CREATE POLICY "season_ranges_update_super_admin" ON season_ranges FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
DROP POLICY IF EXISTS "season_ranges_delete_super_admin" ON season_ranges;
CREATE POLICY "season_ranges_delete_super_admin" ON season_ranges FOR DELETE
  TO authenticated USING (is_super_admin());

-- addon_rates (fixed keys; only prices/names editable)
DROP POLICY IF EXISTS "addon_rates_select_signed_in" ON addon_rates;
CREATE POLICY "addon_rates_select_signed_in" ON addon_rates FOR SELECT
  TO authenticated USING (true);
DROP POLICY IF EXISTS "addon_rates_update_super_admin" ON addon_rates;
CREATE POLICY "addon_rates_update_super_admin" ON addon_rates FOR UPDATE
  TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());
REVOKE INSERT, DELETE ON addon_rates FROM anon, authenticated;

-- bookings & children: read-only for clients
DROP POLICY IF EXISTS "bookings_select_own_or_staff" ON bookings;
CREATE POLICY "bookings_select_own_or_staff" ON bookings FOR SELECT
  TO authenticated USING (agent_id = auth.uid() OR is_staff());
REVOKE INSERT, UPDATE, DELETE ON bookings FROM anon, authenticated;

DROP POLICY IF EXISTS "booking_rooms_select_own_or_staff" ON booking_rooms;
CREATE POLICY "booking_rooms_select_own_or_staff" ON booking_rooms FOR SELECT
  TO authenticated USING (is_staff() OR EXISTS (
    SELECT 1 FROM bookings b WHERE b.id = booking_rooms.booking_id AND b.agent_id = auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON booking_rooms FROM anon, authenticated;

DROP POLICY IF EXISTS "payments_select_own_or_staff" ON payments;
CREATE POLICY "payments_select_own_or_staff" ON payments FOR SELECT
  TO authenticated USING (agent_id = auth.uid() OR is_staff());
REVOKE INSERT, UPDATE, DELETE ON payments FROM anon, authenticated;

DROP POLICY IF EXISTS "booking_events_select_own_or_staff" ON booking_events;
CREATE POLICY "booking_events_select_own_or_staff" ON booking_events FOR SELECT
  TO authenticated USING (is_staff() OR EXISTS (
    SELECT 1 FROM bookings b WHERE b.id = booking_events.booking_id AND b.agent_id = auth.uid()));
REVOKE INSERT, UPDATE, DELETE ON booking_events FROM anon, authenticated;

-- Storage: private receipts bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', false, 5242880,
  ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','application/pdf'];

DROP POLICY IF EXISTS "receipts_insert_own_folder" ON storage.objects;
CREATE POLICY "receipts_insert_own_folder" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "receipts_select_own_or_staff" ON storage.objects;
CREATE POLICY "receipts_select_own_or_staff" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'receipts' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_staff()));

-- Seed data
INSERT INTO room_types (slug, name, description, image_url, total_units, max_adults, max_children,
  rate_low_monsoon, rate_normal_weekday, rate_weekend, rate_peak_holiday, sort_order) VALUES
('garden-fan', 'Garden Fan Chalet', 'Chalet kayu berkipas di tengah taman tropika, 1 katil queen.',
  'https://images.pexels.com/photos/1268871/pexels-photo-1268871.jpeg?auto=compress&cs=tinysrgb&w=1200', 8, 2, 1, 110, 140, 170, 210, 1),
('std-ac-double', 'Standard Aircond Chalet', 'Chalet berhawa dingin, 1 katil queen, bilik air peribadi.',
  'https://images.pexels.com/photos/261102/pexels-photo-261102.jpeg?auto=compress&cs=tinysrgb&w=1200', 12, 2, 1, 160, 200, 240, 300, 2),
('sea-view-deluxe', 'Sea View Deluxe', 'Beranda menghadap laut, 1 katil king, akses terus ke pantai.',
  'https://images.pexels.com/photos/1450363/pexels-photo-1450363.jpeg?auto=compress&cs=tinysrgb&w=1200', 8, 2, 2, 240, 300, 360, 440, 3),
('family-room', 'Family Room', 'Ruang luas untuk keluarga, 2 katil queen + 1 katil single.',
  'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg?auto=compress&cs=tinysrgb&w=1200', 6, 4, 2, 260, 320, 380, 460, 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO addon_rates (key, name, description, price_adult, price_child, sort_order) VALUES
('boat_return', 'Speedboat Transfer (Pergi-Balik)', 'Jeti Kuala Besut <-> Perhentian Bay', 70, 40, 1),
('van_one_way', 'Van Lapangan Terbang (Sehala)', 'KBR Airport -> Jeti Kuala Besut', 45, 30, 2),
('van_return', 'Van Lapangan Terbang (Dua Hala)', 'KBR Airport <-> Jeti Kuala Besut', 85, 55, 3),
('snorkeling', 'Pakej Snorkeling 5 Lokasi', 'Termasuk jaket keselamatan, mask & snorkel', 60, 40, 4)
ON CONFLICT (key) DO NOTHING;

INSERT INTO season_ranges (label, season_type, start_date, end_date)
SELECT * FROM (VALUES
  ('Musim Tengkujuh 2026/27', 'LOW_MONSOON', DATE '2026-11-01', DATE '2027-02-28'),
  ('Cuti Hari Raya Aidilfitri 2027', 'PEAK_HOLIDAY', DATE '2027-03-06', DATE '2027-03-14'),
  ('Cuti Sekolah Pertengahan Tahun 2027', 'PEAK_HOLIDAY', DATE '2027-05-29', DATE '2027-06-13'),
  ('Cuti Hari Kebangsaan 2027', 'PEAK_HOLIDAY', DATE '2027-08-28', DATE '2027-09-01')
) AS v(label, season_type, start_date, end_date)
WHERE NOT EXISTS (SELECT 1 FROM season_ranges);
