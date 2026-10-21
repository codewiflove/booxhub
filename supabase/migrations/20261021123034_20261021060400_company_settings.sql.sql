/*
# Tetapan syarikat dan bank dalam pangkalan data

1. Latar belakang
- Maklumat syarikat (nama, alamat, telefon, emel) dan akaun bank (nama bank, nombor akaun, pemegang) sebelum ini ditulis tetap dalam `lib/company.ts` (frontend). Sebarang penukaran memerlukan penempatan semula aplikasi (redeploy).

2. Perubahan
- Jadual `company_settings` baharu (baris tunggal, id = 1): name, legal_name, address, phone, email, bank_name, bank_account, bank_holder. Diisi dengan nilai semasa dari `lib/company.ts` sebagai data permulaan.
- Fungsi `get_company_settings()`: baca tetapan (semua pengguna yang log masuk - digunakan pada baucar cetak dan invois proforma ejen).
- Fungsi `update_company_settings(...)`: kemas kini tetapan; hanya Super Admin.
- Trigger `refresh_demo_config_snapshot` pada `company_settings`: tetapan dunia demo diasingkan melalui snapshot yang sama seperti room_types/seasons/addon_rates supaya perubahan tetapan oleh pengguna demo tidak menjejaskan dunia sebenar.

3. Keselamatan
- RLS diaktifkan. Polisi SELECT untuk semua pengguna yang disahkan (tetapan syarikat diperlukan pada dokumen cetak ejen); polisi tulis tidak diberikan melalui RLS - kemas kini hanya melalui fungsi `update_company_settings` (SECURITY DEFINER, semakan is_super_admin()).
- Fungsi baca tidak menapis dunia demo: maklumat bank syarikat sama untuk semua dunia, tetapi kemas kini oleh pengguna demo diasingkan oleh trigger snapshot. (Tetapan tidak dipulihkan oleh reset demo kerana ia bukan harga/musim/add-on; ini konsisten dengan perlakuan semasa.)

4. Nota penting
- Baris id=1 diwujudkan dengan ON CONFLICT DO NOTHING supaya selamat diulang.
- `lib/company.ts` dikekalkan sebagai nilai lalai (fallback) dalam kod untuk kes pemuatan awal gagal; panel admin membaca dari pangkalan data.
*/

CREATE TABLE IF NOT EXISTS company_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL DEFAULT 'Perhentian Bay Chalet',
  legal_name text NOT NULL DEFAULT 'Perhentian Bay Chalet Sdn. Bhd.',
  address text NOT NULL DEFAULT 'Pulau Perhentian Kecil, 22300 Besut, Terengganu',
  phone text NOT NULL DEFAULT '+60 9-691 0000',
  email text NOT NULL DEFAULT 'b2b@perhentianbay.com',
  bank_name text NOT NULL DEFAULT 'Maybank',
  bank_account text NOT NULL DEFAULT '5621 0000 0000',
  bank_holder text NOT NULL DEFAULT 'Perhentian Bay Chalet Sdn. Bhd.',
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_company_settings" ON company_settings;
CREATE POLICY "read_company_settings"
ON company_settings FOR SELECT
TO authenticated
USING (true);

-- Snapshot demo: kemas kini tetapan oleh pengguna bukan demo disimpan untuk
-- pemulihan dunia demo (konsisten dengan room_types/seasons/addon_rates).
DROP TRIGGER IF EXISTS company_settings_demo_snapshot ON company_settings;
CREATE TRIGGER company_settings_demo_snapshot AFTER INSERT OR UPDATE OR DELETE ON company_settings
FOR EACH STATEMENT EXECUTE FUNCTION refresh_demo_config_snapshot_trg();

CREATE OR REPLACE FUNCTION get_company_settings() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(s) - 'id' - 'updated_at' FROM company_settings s WHERE s.id = 1;
$$;
REVOKE EXECUTE ON FUNCTION get_company_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_company_settings() TO authenticated;

CREATE OR REPLACE FUNCTION update_company_settings(
  p_name text, p_legal_name text, p_address text, p_phone text, p_email text,
  p_bank_name text, p_bank_account text, p_bank_holder text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_super boolean;
BEGIN
  SELECT is_super_admin() INTO v_super;
  IF NOT v_super THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE company_settings SET
    name = left(trim(p_name), 120),
    legal_name = left(trim(p_legal_name), 160),
    address = left(trim(p_address), 300),
    phone = left(trim(p_phone), 40),
    email = left(trim(p_email), 120),
    bank_name = left(trim(p_bank_name), 80),
    bank_account = left(trim(p_bank_account), 40),
    bank_holder = left(trim(p_bank_holder), 160),
    updated_at = now()
  WHERE id = 1;
END;
$$;
REVOKE EXECUTE ON FUNCTION update_company_settings(text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION update_company_settings(text, text, text, text, text, text, text, text) TO authenticated;