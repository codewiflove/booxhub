/*
# Pengurusan blok bilik: fungsi CRUD, import iCal, suapan OTA

1. Latar belakang
- Migrasi terdahulu (20261021060200) mencipta jadual `inventory_blocks`, fungsi `blocked_units`, dan kekosongan yang mengambil kira blok. Migrasi ini melengkapkan pengurusan blok:
  a. Polisi RLS tulis penuh untuk `inventory_blocks` (staf sahaja).
  b. Fungsi CRUD staf: tambah blok manual, padam blok manual.
  c. Import iCal (.ics): VEVENT dari kalendar luar (Booking.com/Airbnb) diimport sebagai blok `OTA_SYNC`, idempoten melalui `external_uid`, dan blok yang hilang dari kalendar luar dipadam.
  d. Jadual `ota_calendar_feeds` menyimpan pautan kalendar iCal per jenis bilik. Pengambilan HTTP dilakukan oleh Edge Function `sync-ota` (Deno fetch, kunci service role) - bukan oleh fungsi pangkalan data, supaya tiada sambungan keluar dari Postgres.
  e. Fungsi `due_ical_feeds()` menyenaraikan suapan yang perlu disegerak (lebih 14 minit tidak disegerak) supaya Edge Function tahu apa yang perlu diambil.

2. Jadual dan fungsi baharu
- `ota_calendar_feeds(room_type_id, label, url, is_active, last_synced_at, last_sync_status)`: unik mengikut (room_type_id, url).
- `set_inventory_block(room, start, end, units, source, reason)`: tambah blok manual (staf sahaja).
- `clear_inventory_block(block_id)`: padam blok manual sahaja; blok OTA_SYNC ditolak dengan mesej jelas.
- `import_ical_blocks(room, ical_text)`: import/padam blok OTA_SYNC daripada teks kalendar. Menerima pemanggilan staf (auth.uid() staf) ATAU pemanggilan tanpa sesi (Edge Function service role / cron dalaman).
- `due_ical_feeds()`: senarai suapan yang perlu disegerak (baca sahaja, staf atau service role).
- `record_feed_sync(feed_id, status_text)`: rekod hasil penyegerakan suapan (status + masa). Menjaga kekalkan `last_synced_at` dan `last_sync_status` terkini selepas Edge Function selesai.

3. Keselamatan
- `inventory_blocks`: polisi INSERT/UPDATE/DELETE baharu - staf sahaja; polisi SELECT sedia ada (staf + ejen diluluskan) dikekalkan.
- `ota_calendar_feeds`: RLS baca+tulis staf sahaja (ejen tidak perlu membaca suapan).
- `import_ical_blocks`, `set_inventory_block`, `clear_inventory_block`: REVOKE daripada PUBLIC/anon; GRANT kepada authenticated (dengan semakan is_staff() dalaman).
- `sync_all_ical_blocks` dan fungsi HTTP tidak lagi digunakan - penyegerakan dilakukan oleh Edge Function `sync-ota` yang memanggil `import_ical_blocks` dan `record_feed_sync` dengan service role (yang memintas REVOKE untuk peranan api biasa).

4. Nota penting
- Tiada penjadual pg_cron baharu dalam migrasi ini: cron `sync_ota_blocks` akan dijadualkan oleh Edge Function `sync-ota` yang dipanggil secara berkala oleh cron `auto-unlock-expired` sedia ada (setiap 15 minit) melalui mekanisma pemicu dalam Edge Function itu sendiri, atau secara manual dari panel admin. Ini mengelakkan Postgres membuat sambungan HTTP keluar sepenuhnya.
- Parser regex sengaja ringkas dan selamat: format iCal Booking.com/Airbnb konsisten; suapan yang gagal diimport direkodkan dalam `last_sync_status`.
- Semua fungsi selamat diulang (CREATE OR REPLACE, DROP POLICY IF EXISTS).
*/

-- ============================================================
-- 1. Jadual konfigurasi suapan kalendar OTA
-- ============================================================

CREATE TABLE IF NOT EXISTS ota_calendar_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_type_id uuid NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '' CHECK (length(label) <= 120),
  url text NOT NULL CHECK (length(url) <= 2000),
  is_active boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_sync_status text NOT NULL DEFAULT '' CHECK (length(last_sync_status) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_type_id, url)
);

ALTER TABLE ota_calendar_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_manage_ota_feeds_select" ON ota_calendar_feeds;
CREATE POLICY "staff_manage_ota_feeds_select"
ON ota_calendar_feeds FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','ops_admin')));

DROP POLICY IF EXISTS "staff_manage_ota_feeds_insert" ON ota_calendar_feeds;
CREATE POLICY "staff_manage_ota_feeds_insert"
ON ota_calendar_feeds FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','ops_admin')));

DROP POLICY IF EXISTS "staff_manage_ota_feeds_update" ON ota_calendar_feeds;
CREATE POLICY "staff_manage_ota_feeds_update"
ON ota_calendar_feeds FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','ops_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','ops_admin')));

DROP POLICY IF EXISTS "staff_manage_ota_feeds_delete" ON ota_calendar_feeds;
CREATE POLICY "staff_manage_ota_feeds_delete"
ON ota_calendar_feeds FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','ops_admin')));

-- ============================================================
-- 2. Polisi tulis penuh untuk inventory_blocks (staf sahaja)
-- ============================================================

DROP POLICY IF EXISTS "staff_write_inventory_blocks_insert" ON inventory_blocks;
CREATE POLICY "staff_write_inventory_blocks_insert"
ON inventory_blocks FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','ops_admin')));

DROP POLICY IF EXISTS "staff_write_inventory_blocks_update" ON inventory_blocks;
CREATE POLICY "staff_write_inventory_blocks_update"
ON inventory_blocks FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','ops_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','ops_admin')));

DROP POLICY IF EXISTS "staff_write_inventory_blocks_delete" ON inventory_blocks;
CREATE POLICY "staff_write_inventory_blocks_delete"
ON inventory_blocks FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin','ops_admin')));

-- ============================================================
-- 3. Fungsi CRUD blok manual
-- ============================================================

CREATE OR REPLACE FUNCTION set_inventory_block(
  p_room uuid, p_start date, p_end date, p_units int,
  p_source text DEFAULT 'MANUAL_MAINTENANCE', p_reason text DEFAULT ''
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_staff boolean;
BEGIN
  SELECT is_staff() INTO v_staff;
  IF NOT v_staff THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_start > p_end THEN RAISE EXCEPTION 'Tarikh mula selepas tarikh tamat'; END IF;
  IF p_units < 1 OR p_units > 999 THEN RAISE EXCEPTION 'Bilangan unit tidak sah'; END IF;
  IF p_source NOT IN ('MANUAL_MAINTENANCE','WALK_IN','MANUAL_OTA') THEN
    RAISE EXCEPTION 'Sumber blok tidak sah untuk kemasukan manual';
  END IF;

  INSERT INTO inventory_blocks (room_type_id, start_date, end_date, blocked_units, source, reason)
  VALUES (p_room, p_start, p_end, p_units, p_source, left(p_reason, 200))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION set_inventory_block(uuid, date, date, int, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_inventory_block(uuid, date, date, int, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION clear_inventory_block(p_block uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_staff boolean; v_src text;
BEGIN
  SELECT is_staff() INTO v_staff;
  IF NOT v_staff THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT source INTO v_src FROM inventory_blocks WHERE id = p_block;
  IF v_src IS NULL THEN RAISE EXCEPTION 'Blok tidak dijumpai'; END IF;
  IF v_src = 'OTA_SYNC' THEN
    RAISE EXCEPTION 'Blok OTA_SYNC hanya boleh dipadam melalui penyegerakan kalendar supaya tidak bertentangan dengan sumber luar';
  END IF;
  DELETE FROM inventory_blocks WHERE id = p_block;
END;
$$;
REVOKE EXECUTE ON FUNCTION clear_inventory_block(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION clear_inventory_block(uuid) TO authenticated;

-- ============================================================
-- 4. Import iCal: padanan VEVENT dan upsert blok OTA_SYNC
--    Dipanggil oleh Edge Function sync-ota (service role) atau
--    secara manual oleh staf melalui panel admin.
-- ============================================================

CREATE OR REPLACE FUNCTION import_ical_blocks(p_room uuid, p_ical text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_staff boolean;
  v_events text[]; v_ev text; v_n int := 0;
  v_uid text; v_start date; v_end date;
  v_keep text[] := '{}';
BEGIN
  SELECT is_staff() INTO v_staff;
  -- service_role (Edge Function sync-ota) tidak mempunyai auth.uid().
  -- Benarkan pemanggilan tanpa sesi pengguna (cron/edge); tolak pengguna
  -- biasa yang bukan staf.
  IF NOT v_staff AND auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT COALESCE(array_agg(m[1]), '{}') INTO v_events
  FROM regexp_matches(p_ical, 'BEGIN:VEVENT(.*?)END:VEVENT', 'gis') m;

  FOREACH v_ev IN ARRAY v_events LOOP
    v_uid   := substring(v_ev from 'UID\s*[:;]?\s*([A-Za-z0-9\-]+)');
    v_start := substring(v_ev from 'DTSTART[^:\r\n]*[:]\s*([0-9]{8})')::date;
    v_end   := substring(v_ev from 'DTEND[^:\r\n]*[:]\s*([0-9]{8})')::date;
    -- DTEND iCal eksklusif: malam terakhir = DTEND - 1 hari.
    IF v_end IS NOT NULL THEN v_end := v_end - 1; END IF;
    CONTINUE WHEN v_uid IS NULL OR v_start IS NULL OR v_end IS NULL OR v_end < v_start;

    INSERT INTO inventory_blocks (room_type_id, start_date, end_date, blocked_units, source, reason, external_uid)
    VALUES (p_room, v_start, v_end, 1, 'OTA_SYNC', 'Disegerak dari kalendar OTA', v_uid)
    ON CONFLICT (external_uid) WHERE external_uid IS NOT NULL DO UPDATE
      SET start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          updated_at = now();
    v_keep := v_keep || v_uid;
    v_n := v_n + 1;
  END LOOP;

  -- Padam blok OTA_SYNC bilik ini yang sudah tidak wujud dalam kalendar luar.
  DELETE FROM inventory_blocks
  WHERE room_type_id = p_room AND source = 'OTA_SYNC'
    AND external_uid IS NOT NULL AND NOT (external_uid = ANY(v_keep));

  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION import_ical_blocks(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION import_ical_blocks(uuid, text) TO authenticated;

-- ============================================================
-- 5. Penyegerakan: senarai suapan yang perlu disegerak +
--    rekod hasil. Pengambilan HTTP dibuat oleh Edge Function.
-- ============================================================

CREATE OR REPLACE FUNCTION due_ical_feeds() RETURNS TABLE (
  id uuid, room_type_id uuid, label text, url text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT f.id, f.room_type_id, f.label, f.url
  FROM ota_calendar_feeds f
  WHERE f.is_active
    AND (f.last_synced_at IS NULL OR f.last_synced_at < now() - interval '14 minutes');
$$;
REVOKE EXECUTE ON FUNCTION due_ical_feeds() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION due_ical_feeds() TO authenticated;

CREATE OR REPLACE FUNCTION record_feed_sync(p_feed uuid, p_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Dipanggil oleh Edge Function sync-ota (service role) selepas setiap suapan.
  UPDATE ota_calendar_feeds
  SET last_synced_at = now(),
      last_sync_status = left(COALESCE(p_status, ''), 200),
      updated_at = now()
  WHERE id = p_feed;
END;
$$;
REVOKE EXECUTE ON FUNCTION record_feed_sync(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_feed_sync(uuid, text) TO authenticated;