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
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-2 text-sm text-sand-900">
          <FlaskConical className="h-4 w-4 shrink-0 text-sand-700" />
          <p className="truncate leading-snug">
            <span className="font-semibold">Demo {isAgent ? 'Ejen' : 'Admin'}</span>
            <span className="hidden sm:inline"> &middot; Data di sini berasingan daripada data sebenar.</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={switchRole}
            disabled={busy !== null}
            className="tap inline-flex h-9 items-center gap-1.5 rounded-full bg-ocean-900 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-ocean-800 disabled:opacity-60"
          >
            {busy === 'switch' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowLeftRight className="h-3.5 w-3.5" />}
            {isAgent ? 'Admin' : 'Ejen'}
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                disabled={busy !== null}
                aria-label="Set semula data demo"
                className="tap inline-flex h-9 items-center gap-1.5 rounded-full border border-sand-400 bg-white px-3 text-xs font-semibold text-sand-900 transition-colors hover:bg-sand-50 disabled:opacity-60"
              >
                {busy === 'reset' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Set Semula</span>
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
