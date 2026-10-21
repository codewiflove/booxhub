'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Ban, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/components/auth/auth-layout';
import { useAuth, homePathFor } from '@/components/auth/auth-provider';

export default function PendingPage() {
  const router = useRouter();
  const { session, profile, loading, refreshProfile, signOut } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/login');
    else if (profile?.status === 'approved') router.replace(homePathFor(profile));
  }, [loading, session, profile, router]);

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-ocean-600" />
      </div>
    );
  }

  const suspended = profile.status === 'suspended';
  return (
    <AuthLayout
      title={suspended ? 'Akaun digantung' : 'Menunggu kelulusan'}
      subtitle={
        suspended
          ? 'Akaun anda telah digantung sementara. Sila hubungi pengurus Perhentian Bay Chalet.'
          : `Terima kasih, ${profile.company_name || profile.full_name}. Pengurus kami sedang menyemak pendaftaran anda.`
      }
    >
      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-start gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${suspended ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
            {suspended ? <Ban className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </span>
          <div className="text-sm text-muted-foreground">
            {suspended
              ? 'Anda tidak boleh membuat tempahan baharu sehingga akaun diaktifkan semula.'
              : 'Kelulusan biasanya mengambil masa kurang daripada 1 hari bekerja. Selepas diluluskan, anda boleh terus melihat kalendar bilik dan membuat tempahan.'}
          </div>
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <Button variant="outline" className="flex-1" onClick={() => refreshProfile()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Semak semula
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => signOut()}>
          Log keluar
        </Button>
      </div>
    </AuthLayout>
  );
}
