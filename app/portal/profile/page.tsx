'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shell/app-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/lib/supabase';
import { formatDate, friendlyError } from '@/lib/format';

const FIELDS = [
  { key: 'full_name', label: 'Nama penuh', required: true },
  { key: 'company_name', label: 'Nama syarikat / agensi', required: true },
  { key: 'phone', label: 'No. telefon', required: true },
  { key: 'license_no', label: 'No. lesen MOTAC', required: false },
] as const;

type Form = Record<(typeof FIELDS)[number]['key'], string>;

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [form, setForm] = useState<Form>({ full_name: '', company_name: '', phone: '', license_no: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name, company_name: profile.company_name, phone: profile.phone, license_no: profile.license_no });
  }, [profile]);

  if (!profile) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim().slice(0, 160)])) as Form;
    if (!clean.full_name || !clean.company_name || !clean.phone) { toast.error('Sila lengkapkan semua ruangan wajib.'); return; }
    setSaving(true);
    const { error } = await supabase.from('profiles').update(clean).eq('id', profile.id);
    setSaving(false);
    if (error) { toast.error(friendlyError(error, 'Gagal menyimpan profil.')); return; }
    await refreshProfile();
    toast.success('Profil dikemas kini.');
  };

  return (
    <>
      <PageHeader title="Profil Agensi" description="Nama syarikat anda akan dipaparkan pada baucar white-label untuk tetamu." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={save} className="animate-fade-up space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}{f.required && <span className="text-coral-600"> *</span>}</Label>
                <Input id={f.key} value={form[f.key]} maxLength={160} className="h-11"
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t pt-5">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Simpan
            </Button>
          </div>
        </form>
        <aside className="space-y-3 rounded-2xl border bg-ocean-950 p-6 text-ocean-50">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ocean-300">Akaun</p>
          <div><p className="text-sm text-ocean-300">E-mel</p><p className="break-all font-medium">{profile.email}</p></div>
          <div><p className="text-sm text-ocean-300">Ahli sejak</p><p className="font-medium">{formatDate(profile.created_at.slice(0, 10))}</p></div>
          <div><p className="text-sm text-ocean-300">Status hold</p>
            <p className="font-medium">{profile.hold_blocked ? 'Terhad (1 jam, bayar segera)' : 'Normal'}</p></div>
        </aside>
      </div>
    </>
  );
}
