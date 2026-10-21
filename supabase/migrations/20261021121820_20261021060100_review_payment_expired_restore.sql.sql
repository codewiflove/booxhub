/*
# Pulihkan tempahan EXPIRED semasa semakan resit jika bilik masih kosong

1. Latar belakang
- Sebelum ini, `review_payment(p_payment, p_approve, p_note)` melemparkan pengecualian `Tempahan ini sudah tidak aktif` jika tempahan berstatus EXPIRED atau CANCELLED, walaupun resit pembayaran yang sah telah dimuat naik sebelum hold tamat.
- Ini menyebabkan ejen kehilangan tempahan walaupun mereka sudah bayar deposit tepat pada masanya tetapi resit disemak lewat (contohnya cron auto-expire berjalan lebih dulu, atau admin menyemak selepas waktu pejabat).

2. Perubahan
- `review_payment` ditulis semula. Apabila staf meluluskan resit untuk tempahan yang berstatus `EXPIRED`:
  a. Sistem menyemak semula kekosongan bilik untuk setiap kombinasi jenis bilik x tarikh dalam tempahan tersebut (menggunakan `get_availability(start, check_out - 1)`).
  b. Jika semua unit yang ditempah masih tersedia, tempahan dipulihkan kepada status yang sepatutnya (`CONFIRMED_PARTIAL` atau `FULLY_PAID`), `expired_at` dibatalkan, dan pembayaran direkodkan seperti biasa.
  c. Jika mana-mana bilik sudah diambil oleh tempahan lain, fungsi melempar pengecualian yang jelas supaya staf tahu tempahan tidak boleh dipulihkan dan boleh memaklumkan ejen membuat tempahan baharu.
- Tempahan berstatus `CANCELLED` kekal tidak boleh dipulihkan (dibatalkan secara sengaja) - pengecualian seperti biasa.
- Tingkah laku lalai (tempahan aktif) tidak berubah.

3. Keselamatan
- Fungsi kekal `SECURITY DEFINER SET search_path = public` dengan semakan `is_staff()` yang sama. Pemberian privilege tidak berubah (authenticated sahaja).
- Semakan kekosongan menggunakan fungsi `get_availability` sedia ada yang mengambil kira dunia demo (in_my_world).

4. Nota penting
- `booking_events` direkodkan dengan peristiwa `PAYMENT_VERIFIED` seperti biasa, dengan nota tambahan "Tempahan dipulihkan" apabila pemulihan berlaku, supaya jejak audit jelas.
- Migrasi ini selamat diulang (CREATE OR REPLACE FUNCTION).
*/

CREATE OR REPLACE FUNCTION review_payment(p_payment uuid, p_approve boolean, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p payments; v_b bookings; v_paid numeric;
  v_avail record; v_need int; v_restore boolean := false;
  v_kind_check boolean;
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

  IF v_b.status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Tempahan ini telah dibatalkan secara sengaja dan tidak boleh dipulihkan';
  END IF;

  -- Pemulihan tempahan EXPIRED: semak semula kekosongan semua bilik pada tarikh asal.
  IF v_b.status = 'EXPIRED' THEN
    v_restore := true;
    FOR v_avail IN
      SELECT a.room_type_id, sum(a.available) AS free_units
      FROM get_availability(v_b.check_in, v_b.check_out - 1) a
      JOIN booking_rooms br ON br.room_type_id = a.room_type_id AND br.booking_id = v_b.id
      GROUP BY a.room_type_id
    LOOP
      SELECT sum(quantity) INTO v_need FROM booking_rooms
      WHERE booking_id = v_b.id AND room_type_id = v_avail.room_type_id;
      IF v_avail.free_units < v_need THEN
        v_restore := false;
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_restore THEN
      RAISE EXCEPTION 'Bilik untuk tempahan ini telah diambil oleh tempahan lain selepas hold tamat tempoh. Tempahan tidak boleh dipulihkan. Sila maklumkan ejen untuk membuat tempahan baharu.';
    END IF;
  END IF;

  v_paid := v_b.paid_amount + v_p.amount;
  IF v_restore THEN
    UPDATE bookings SET paid_amount = v_paid,
      status = CASE WHEN v_paid >= grand_total THEN 'FULLY_PAID' ELSE 'CONFIRMED_PARTIAL' END,
      expired_at = NULL, updated_at = now()
      WHERE id = v_b.id;
  ELSE
    UPDATE bookings SET paid_amount = v_paid,
      status = CASE WHEN v_paid >= grand_total THEN 'FULLY_PAID' ELSE 'CONFIRMED_PARTIAL' END,
      updated_at = now()
      WHERE id = v_b.id;
  END IF;
  UPDATE profiles SET consecutive_expired = 0 WHERE id = v_b.agent_id;

  PERFORM log_booking_event(v_b.id, 'PAYMENT_VERIFIED',
    'Bayaran RM' || to_char(v_p.amount, 'FM999999990.00') || ' disahkan. Status: ' ||
    CASE WHEN v_paid >= v_b.grand_total THEN 'Dibayar Penuh' ELSE 'Disahkan (Deposit)' END ||
    CASE WHEN v_restore THEN '. Tempahan yang tamat tempoh telah dipulihkan kerana bilik masih kosong.' ELSE '' END);
END;
$$;

REVOKE EXECUTE ON FUNCTION review_payment(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION review_payment(uuid, boolean, text) TO authenticated;
