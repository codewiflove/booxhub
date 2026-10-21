'use client';

import { useState } from 'react';
import { ArrowLeftRight, FlaskConical, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { demoSignIn } from '@/lib/demo';
import { friendlyError } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export function DemoBanner() {
  const { profile } = useAuth();
  const [busy, setBusy] = useState<'switch' | 'reset' | null>(null);

  if (!profile?.is_demo) return null;

  const isAgent = profile.role === 'agent';
  const target = isAgent ? 'admin' : 'agent';

  async function switchRole() {
    setBusy('switch');
    try {
      await demoSignIn(target);
      window.location.assign(target === 'agent' ? '/portal' : '/admin');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menukar akaun demo.');
      setBusy(null);
    }
  }

  async function resetData() {
    setBusy('reset');
    const { error } = await supabase.rpc('reset_demo_data');
    if (error) {
      toast.error(friendlyError(error, 'Gagal menetapkan semula data demo.'));
      setBusy(null);
      return;
    }
    toast.success('Data demo telah ditetapkan semula.');
    window.location.reload();
  }

  return (
    <div className="no-print border-b border-sand-300 bg-sand-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <div className="flex items-start gap-2.5 text-sm text-sand-900">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-sand-700" />
          <p className="leading-relaxed">
            <span className="font-semibold">Mod Demo</span> &middot; Anda sedang menguji sebagai{' '}
            <span className="font-semibold">{isAgent ? 'Ejen' : 'Admin'}</span>. Data di sini berasingan daripada data sebenar.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={switchRole}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-ocean-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-ocean-800 disabled:opacity-60"
          >
            {busy === 'switch' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
            Tukar ke {isAgent ? 'Admin' : 'Ejen'}
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sand-400 bg-white px-3 py-1.5 text-xs font-semibold text-sand-900 transition-colors hover:bg-sand-50 disabled:opacity-60"
              >
                {busy === 'reset' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Set Semula Data Demo
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Set semula data demo?</AlertDialogTitle>
                <AlertDialogDescription>
                  Semua tempahan, bayaran dan perubahan akaun demo akan dipadam dan diganti dengan data contoh baharu.
                  Harga bilik, musim dan add-on dikembalikan kepada tetapan asal. Data sebenar tidak terjejas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={resetData}>Set Semula</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
