'use client';

import { useMemo, useState } from 'react';
import { Landmark, Loader2, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/lib/supabase';
import { COMPANY } from '@/lib/company';
import { formatRM, friendlyError, PAYMENT_KIND_LABEL } from '@/lib/format';
import { balanceOf } from '@/lib/bookings';
import type { Booking, PaymentKind } from '@/lib/types';
import { cn } from '@/lib/utils';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

export function PaymentDialog({
  booking,
  open,
  onOpenChange,
  onSubmitted,
}: {
  booking: Booking;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmitted: () => void;
}) {
  const options = useMemo(() => {
    if (booking.status === 'PENDING_DEPOSIT') {
      return [
        { kind: 'DEPOSIT_25' as PaymentKind, amount: Number(booking.deposit_required) },
        { kind: 'FULL_100' as PaymentKind, amount: Number(booking.grand_total) },
      ];
    }
    return [{ kind: 'BALANCE_75' as PaymentKind, amount: balanceOf(booking) }];
  }, [booking]);

  const [kind, setKind] = useState<PaymentKind>(options[0].kind);
  const [reference, setReference] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = options.find((o) => o.kind === kind) ?? options[0];

  function pickFile(f: File | null) {
    setError('');
    if (!f) return setFile(null);
    if (!ALLOWED.includes(f.type)) return setError('Hanya fail JPG, PNG, WEBP atau PDF dibenarkan.');
    if (f.size > MAX_BYTES) return setError('Saiz fail maksimum ialah 5MB.');
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError('Sila lampirkan resit bayaran.');
    setBusy(true);
    setError('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('no session');
      const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${auth.user.id}/${booking.id}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { error: rpcErr } = await supabase.rpc('submit_payment', {
        p_booking: booking.id,
        p_kind: selected.kind,
        p_reference: reference.trim(),
        p_receipt_path: path,
      });
      if (rpcErr) throw rpcErr;
      toast.success('Resit dihantar. Bilik kekal dikunci sementara staf menyemak bayaran anda.');
      setReference('');
      setFile(null);
      onOpenChange(false);
      onSubmitted();
    } catch (err) {
      setError(friendlyError(err, 'Resit tidak dapat dihantar. Sila cuba lagi.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-ocean-950">Hantar bayaran</DialogTitle>
          <DialogDescription>Tempahan {booking.code}. Jumlah ditetapkan oleh sistem.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <RadioGroup value={kind} onValueChange={(v) => setKind(v as PaymentKind)} className="grid gap-3">
            {options.map((o) => (
              <Label
                key={o.kind}
                htmlFor={o.kind}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-colors',
                  kind === o.kind ? 'border-ocean-500 bg-ocean-50/60' : 'hover:bg-muted/50'
                )}
              >
                <span className="flex items-center gap-3">
                  <RadioGroupItem id={o.kind} value={o.kind} />
                  <span className="font-semibold">{PAYMENT_KIND_LABEL[o.kind]}</span>
                </span>
                <span className="font-semibold tabular text-ocean-900">{formatRM(o.amount)}</span>
              </Label>
            ))}
          </RadioGroup>

          <div className="flex gap-3 rounded-xl bg-sand-50 p-4 text-sm ring-1 ring-sand-200">
            <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-sand-700" />
            <div>
              <p className="font-semibold text-ocean-950">Pindahan bank / DuitNow</p>
              <p className="text-muted-foreground">
                {COMPANY.bank.name} {COMPANY.bank.account} ({COMPANY.bank.holder})
              </p>
              <p className="mt-1 text-muted-foreground">Gunakan kod {booking.code} sebagai rujukan.</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ref">No. rujukan transaksi</Label>
            <Input id="ref" required minLength={3} maxLength={100} value={reference}
              onChange={(e) => setReference(e.target.value)} placeholder="Contoh: MBB20261021-883412" />
          </div>

          <label
            htmlFor="receipt"
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors',
              file ? 'border-emerald-300 bg-emerald-50/50' : 'hover:border-ocean-300 hover:bg-ocean-50/40'
            )}
          >
            <UploadCloud className={cn('h-6 w-6', file ? 'text-emerald-600' : 'text-ocean-500')} />
            <span className="font-semibold text-ocean-950">{file ? file.name : 'Lampirkan resit'}</span>
            <span className="text-xs text-muted-foreground">JPG, PNG, WEBP atau PDF, maksimum 5MB</span>
            <input id="receipt" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <Button type="submit" className="h-11 w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Hantar resit {formatRM(selected.amount)}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
