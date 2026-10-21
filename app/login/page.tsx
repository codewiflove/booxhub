'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth/auth-layout';
import { DemoLoginBox } from '@/components/auth/demo-login-box';
import { useAuth, homePathFor } from '@/components/auth/auth-provider';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const { session, profile, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session && profile) router.replace(homePathFor(profile));
  }, [loading, session, profile, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      console.error('sign in failed', err);
      setError(
        err.message.toLowerCase().includes('invalid')
          ? 'Emel atau kata laluan tidak betul.'
          : 'Tidak dapat log masuk sekarang. Sila cuba lagi.'
      );
    }
  }

  return (
    <AuthLayout title="Selamat kembali" subtitle="Log masuk ke portal ejen Perhentian Bay Chalet.">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Emel</Label>
          <Input id="email" type="email" required autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="nama@agensi.com" className="h-11" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Kata laluan</Label>
          <Input id="password" type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className="h-11" />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Log Masuk
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Belum ada akaun?{' '}
        <Link href="/register" className="font-semibold text-ocean-700 hover:underline">
          Daftar sebagai ejen
        </Link>
      </p>
      <DemoLoginBox />
    </AuthLayout>
  );
}
