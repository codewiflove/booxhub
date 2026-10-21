'use client';

import { useEffect, useState } from 'react';
import { FlaskConical, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { fetchDemoEnabled } from '@/lib/demo';
import { friendlyError } from '@/lib/format';
import { supabase } from '@/lib/supabase';

export function DemoAccessDialog() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<'toggle' | 'reset' | 'purge' | null>(null);

  useEffect(() => {
    if (open) fetchDemoEnabled().then(setEnabled);
  }, [open]);

  async function toggle(next: boolean) {
    setBusy('toggle');
    const { error } = await supabase.rpc('set_demo_enabled', { p_enabled: next });
    setBusy(null);
    if (error) { toast.error(friendlyError(error, 'Gagal mengemas kini akses demo.')); return; }
    setEnabled(next);
    toast.success(next ? 'Akses demo dihidupkan.' : 'Akses demo dimatikan. Akaun demo tidak boleh digunakan.');
  }

  async function reset() {
    setBusy('reset');
    const { error } = await supabase.rpc('reset_demo_data');
    setBusy(null);
    if (error) { toast.error(friendlyError(error, 'Gagal menetapkan semula data demo.')); return; }
    toast.success('Data demo telah ditetapkan semula.');
  }

  async function purge() {
    setBusy('purge');
    const { error } = await supabase.rpc('purge_demo_data');
    setBusy(null);
    if (error) { toast.error(friendlyError(error, 'Gagal memadam data demo.')); return; }
    setEnabled(false);
    toast.success('Semua akaun dan data demo telah dipadam.');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><FlaskConical className="mr-1.5 h-4 w-4" /> Akses Demo</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Akses Demo</DialogTitle>
          <DialogDescription>
            Akaun demo membolehkan sesiapa mencuba sistem sebagai Admin atau Ejen tanpa mendaftar.
            Tempahan dan akaun demo diasingkan sepenuhnya daripada data sebenar.
          </DialogDescription>
        </DialogHeader>

        {enabled === null ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-ocean-600" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
              <div>
                <p className="font-semibold text-ocean-950">Tunjuk butang demo di halaman log masuk</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Jika dimatikan, butang demo hilang dan akaun demo digantung serta-merta.
                </p>
              </div>
              <Switch checked={enabled} disabled={busy !== null} onCheckedChange={toggle} aria-label="Akses demo" />
            </div>

            <div className="rounded-xl border p-4">
              <p className="font-semibold text-ocean-950">Set semula data demo</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ganti tempahan demo dengan data contoh baharu dan kembalikan harga, musim serta add-on kepada tetapan sebenar terakhir.
              </p>
              <Button size="sm" variant="outline" className="mt-3" disabled={busy !== null} onClick={reset}>
                {busy === 'reset' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
                Set Semula
              </Button>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
              <p className="font-semibold text-red-800">Padam semua data demo</p>
              <p className="mt-1 text-sm text-red-700/80">
                Padam akaun demo dan semua tempahan demo secara kekal. Data sebenar tidak disentuh. Sesuai sebelum sistem dilancarkan.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="mt-3 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800" disabled={busy !== null}>
                    {busy === 'purge' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
                    Padam Data Demo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Padam semua data demo?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Akaun Demo Admin, Demo Ejen, pemohon contoh dan semua tempahan demo akan dipadam. Akses demo juga akan dimatikan.
                      Anda boleh menghidupkannya semula kemudian dan data contoh baharu akan dijana.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={purge} className="bg-red-600 hover:bg-red-700">Padam</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
