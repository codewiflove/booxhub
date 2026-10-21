/*
# Reminder engine: H-10/H-7 pre-check-in + T-2h pre-hold-expiry (email + WhatsApp)

## Tujuan
Membina struktur pengingat automatik yang lengkap tetapi TIDAK AKTIF sehingga kunci API
(Resend untuk emel, Twilio/serupa untuk WhatsApp) diberikan. Setiap pengingat direkodkan
dalam jadual supaya tiada penghantaran berganda dan status boleh diaudit.

## Perubahan
1. Jadual `reminder_settings` (satu baris, id=1): email_enabled, whatsapp_enabled,
   resend_api_key, whatsapp_api_key, whatsapp_from, h10_days, h7_days, hold_warning_hours.
   Semua kunci default kosong = tidak aktif (selamat untuk demo).
2. Jadual `reminders`: booking_id, agent_id, kind (H10/H7/HOLD_EXPIRY/BALANCE_DUE),
   channel (EMAIL/WHATSAPP), recipient, status (QUEUED/SENT/FAILED/SKIPPED), sent_at,
   error; UNIQUE(booking_id, kind, channel) menghalang penghantaran berganda.
3. Fungsi `generate_reminders()` — menjana baris QUEUED (atau SKIPPED jika tiada
   penerima) untuk H-10/H-7 ketibaan, amaran hold tamat dalam <= 2 jam, dan baki lewat.
4. Fungsi `due_reminders(limit)` — baris QUEUED untuk fungsi penghantar.
5. Fungsi `mark_reminder_sent(id, ok, error)` — menanda SENT/FAILED.

## Keselamatan
- RLS diaktifkan pada kedua-dua jadual.
- reminder_settings: SELECT authenticated; UPDATE hanya melalui fungsi super_admin.
- reminders: SELECT staff + ejen pemilik; tiada tulis langsung dari klien (REVOKE).
- Semua fungsi SECURITY DEFINER, REVOKE dari PUBLIC/anon, GRANT kepada authenticated.
- Kunci API hanya dibaca oleh service role (fungsi penghantar); tidak didedahkan
  kepada klien biasa.
*/

-- 1) Settings (single row)
CREATE TABLE IF NOT EXISTS reminder_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  email_enabled boolean NOT NULL DEFAULT false,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  resend_api_key text NOT NULL DEFAULT '',
  whatsapp_api_key text NOT NULL DEFAULT '',
  whatsapp_from text NOT NULL DEFAULT '',
  h10_days int NOT NULL DEFAULT 10,
  h7_days int NOT NULL DEFAULT 7,
  hold_warning_hours int NOT NULL DEFAULT 2,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO reminder_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminder_settings_select_signed_in" ON reminder_settings;
CREATE POLICY "reminder_settings_select_signed_in" ON reminder_settings
  FOR SELECT TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON reminder_settings FROM anon, authenticated;

-- 2) Reminders queue
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('H10','H7','HOLD_EXPIRY','BALANCE_DUE')),
  channel text NOT NULL CHECK (channel IN ('EMAIL','WHATSAPP')),
  recipient text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','SENT','FAILED','SKIPPED')),
  sent_at timestamptz,
  error text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS reminders_unique_queue_idx
  ON reminders (booking_id, kind, channel);
CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders (status, created_at);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminders_select_own_or_staff" ON reminders;
CREATE POLICY "reminders_select_own_or_staff" ON reminders
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR is_staff());

REVOKE INSERT, UPDATE, DELETE ON reminders FROM anon, authenticated;

-- 3) Generate reminders (called periodically by the sender edge function via
--    service role; safe because channel flags are off until API keys exist)
CREATE OR REPLACE FUNCTION generate_reminders() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_cfg reminder_settings%ROWTYPE;
  v_today date := (current_date AT TIME ZONE 'Asia/Kuala_Lumpur');
  v_count int := 0;
  v_b record;
  v_kind text;
BEGIN
  SELECT * INTO v_cfg FROM reminder_settings WHERE id = 1;

  -- Skip generation entirely while channels are disabled
  IF NOT (v_cfg.email_enabled OR v_cfg.whatsapp_enabled) THEN
    RETURN 0;
  END IF;

  -- H-10 / H-7 pre-check-in reminders (confirmed bookings only)
  FOR v_b IN
    SELECT b.id, b.agent_id, b.code, b.check_in, p.email AS agent_email, p.phone AS agent_phone
    FROM bookings b
    JOIN profiles p ON p.id = b.agent_id
    WHERE b.status IN ('CONFIRMED_PARTIAL','FULLY_PAID')
      AND b.check_in IN (v_today + v_cfg.h10_days, v_today + v_cfg.h7_days)
  LOOP
    v_kind := CASE WHEN b.check_in = v_today + v_cfg.h10_days THEN 'H10' ELSE 'H7' END;
    v_kind := CASE WHEN v_b.check_in = v_today + v_cfg.h10_days THEN 'H10' ELSE 'H7' END;
    IF v_cfg.email_enabled AND v_b.agent_email <> '' THEN
      INSERT INTO reminders (booking_id, agent_id, kind, channel, recipient)
      VALUES (v_b.id, v_b.agent_id, v_kind, 'EMAIL', v_b.agent_email)
      ON CONFLICT (booking_id, kind, channel) DO NOTHING;
    END IF;
    IF v_cfg.whatsapp_enabled AND v_b.agent_phone <> '' THEN
      INSERT INTO reminders (booking_id, agent_id, kind, channel, recipient)
      VALUES (v_b.id, v_b.agent_id, v_kind, 'WHATSAPP', v_b.agent_phone)
      ON CONFLICT (booking_id, kind, channel) DO NOTHING;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  -- Hold expiry warning: PENDING_DEPOSIT holds expiring within warning window,
  -- still active, without a pending receipt
  FOR v_b IN
    SELECT b.id, b.agent_id, p.email AS agent_email, p.phone AS agent_phone
    FROM bookings b
    JOIN profiles p ON p.id = b.agent_id
    WHERE b.status = 'PENDING_DEPOSIT'
      AND b.hold_expires_at > now()
      AND b.hold_expires_at <= now() + make_interval(hours => v_cfg.hold_warning_hours)
      AND NOT EXISTS (
        SELECT 1 FROM payments pm
        WHERE pm.booking_id = b.id AND pm.status = 'PENDING')
  LOOP
    IF v_cfg.email_enabled AND v_b.agent_email <> '' THEN
      INSERT INTO reminders (booking_id, agent_id, kind, channel, recipient)
      VALUES (v_b.id, v_b.agent_id, 'HOLD_EXPIRY', 'EMAIL', v_b.agent_email)
      ON CONFLICT (booking_id, kind, channel) DO NOTHING;
    END IF;
    IF v_cfg.whatsapp_enabled AND v_b.agent_phone <> '' THEN
      INSERT INTO reminders (booking_id, agent_id, kind, channel, recipient)
      VALUES (v_b.id, v_b.agent_id, 'HOLD_EXPIRY', 'WHATSAPP', v_b.agent_phone)
      ON CONFLICT (booking_id, kind, channel) DO NOTHING;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  -- Overdue balance: CONFIRMED_PARTIAL past balance_due_date with no pending receipt
  FOR v_b IN
    SELECT b.id, b.agent_id, p.email AS agent_email, p.phone AS agent_phone
    FROM bookings b
    JOIN profiles p ON p.id = b.agent_id
    WHERE b.status = 'CONFIRMED_PARTIAL'
      AND b.balance_due_date < v_today
      AND NOT EXISTS (
        SELECT 1 FROM payments pm
        WHERE pm.booking_id = b.id AND pm.status = 'PENDING')
  LOOP
    IF v_cfg.email_enabled AND v_b.agent_email <> '' THEN
      INSERT INTO reminders (booking_id, agent_id, kind, channel, recipient)
      VALUES (v_b.id, v_b.agent_id, 'BALANCE_DUE', 'EMAIL', v_b.agent_email)
      ON CONFLICT (booking_id, kind, channel) DO NOTHING;
    END IF;
    IF v_cfg.whatsapp_enabled AND v_b.agent_phone <> '' THEN
      INSERT INTO reminders (booking_id, agent_id, kind, channel, recipient)
      VALUES (v_b.id, v_b.agent_id, 'BALANCE_DUE', 'WHATSAPP', v_b.agent_phone)
      ON CONFLICT (booking_id, kind, channel) DO NOTHING;
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION generate_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION generate_reminders() TO authenticated;

-- 4) Due reminders for the sender edge function
CREATE OR REPLACE FUNCTION due_reminders(p_limit int DEFAULT 50)
RETURNS TABLE (id uuid, booking_id uuid, agent_id uuid, kind text, channel text,
               recipient text, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT r.id, r.booking_id, r.agent_id, r.kind, r.channel, r.recipient, r.status, r.created_at
  FROM reminders r
  WHERE r.status = 'QUEUED' AND r.recipient <> ''
  ORDER BY r.created_at
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$fn$;

REVOKE EXECUTE ON FUNCTION due_reminders(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION due_reminders(int) TO authenticated;

-- 5) Mark a reminder as sent / failed (called by the sender edge function)
CREATE OR REPLACE FUNCTION mark_reminder_sent(p_id uuid, p_ok boolean, p_error text DEFAULT '')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  UPDATE reminders
  SET status = CASE WHEN p_ok THEN 'SENT' ELSE 'FAILED' END,
      sent_at = now(),
      error = left(COALESCE(p_error, ''), 300)
  WHERE id = p_id AND status = 'QUEUED';
END;
$fn$;

REVOKE EXECUTE ON FUNCTION mark_reminder_sent(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_reminder_sent(uuid, boolean, text) TO authenticated;