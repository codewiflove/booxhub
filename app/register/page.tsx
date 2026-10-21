'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth/auth-layout';
import { useAuth, homePathFor } from '@/components/auth/auth-provider';
import { supabase } from '@/lib/supabase';

const FIELDS = [
  { key: 'company_name', label: 'Nama agensi / syarikat', placeholder: 'Contoh: Pulau Holidays Sdn Bhd', type: 'text' },
  { key: 'full_name', label: 'Nama penuh wakil', placeholder: 'Nama seperti dalam IC', type: 'text' },
  { key: 'phone', label: 'No. telefon (WhatsApp)', placeholder: '012-345 6789', type: 'tel' },
  { key: 'license_no', label: 'No. lesen MOTAC / SSM', placeholder: 'KPK/LN 1234', type: 'text' },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [form, setForm] = useState({ company_name: '', full_name: '', phone: '', license_no: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session && profile) router.replace(homePathFor(profile));
  }, [loading, session, profile, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Kata laluan mestilah sekurang-kurangnya 8 aksara.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          company_name: form.company_name.trim(),
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          license_no: form.license_no.trim(),
        },
      },
    });
    setBusy(false);
    if (err) {
      console.error('sign up failed', err);
      setError('Pendaftaran tidak berjaya. Semak emel anda atau cuba log masuk jika sudah berdaftar.');
    }
  }

  return (
    <AuthLayout title="Daftar sebagai ejen" subtitle="Akaun anda akan disemak dan diluluskan oleh pengurus.">
      <form onSubmit={onSubmit} className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Input id={f.key} type={f.type} required value={form[f.key]} placeholder={f.placeholder} className="h-11"
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          </div>
        ))}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Emel</Label>
            <Input id="email" type="email" required autoComplete="email" value={form.email} className="h-11"
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Kata laluan</Label>
            <Input id="password" type="password" required autoComplete="new-password" value={form.password}
              className="h-11" onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Hantar Pendaftaran
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Sudah berdaftar?{' '}
        <Link href="/login" className="font-semibold text-ocean-700 hover:underline">
          Log masuk
        </Link>
      </p>
    </AuthLayout>
  );
}
