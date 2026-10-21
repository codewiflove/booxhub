'use client';

import { useState } from 'react';
import { Check, ExternalLink, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { formatDateTime, formatRM, friendlyError, PAYMENT_KIND_LABEL } from '@/lib/format';
import { PaymentStatusBadge } from './badges';
import type { Payment } from '@/lib/types';

export async function openReceipt(path: string) {
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    console.error('receipt url failed', error);
    toast.error('Resit tidak dapat dibuka.');
    return;
  }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

export function PaymentReviewActions({ payment, onDone }: { payment: Payment; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  async function review(approve: boolean) {
    setBusy(approve ? 'approve' : 'reject');
    const { error } = await supabase.rpc('review_payment', { p_payment: payment.id, p_approve: approve, p_note: note.trim() });
    setBusy(null);
    if (error) {
      toast.error(friendlyError(error, 'Semakan tidak dapat disimpan.'));
      return;
    }
    toast.success(approve ? 'Bayaran disahkan. Tempahan dikemas kini.' : 'Resit ditolak.');
    onDone();
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (pilihan)" className="h-9 sm:w-48" maxLength={500} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => review(true)} disabled={!!busy} className="bg-emerald-600 hover:bg-emerald-700">
          {busy === 'approve' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />} Sahkan
        </Button>
        <Button size="sm" variant="outline" onClick={() => review(false)} disabled={!!busy} className="text-red-700 hover:bg-red-50 hover:text-red-700">
          {busy === 'reject' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <X className="mr-1 h-4 w-4" />} Tolak
        </Button>
      </div>
    </div>
  );
}

export function PaymentList({ payments, canReview, onChanged }: { payments: Payment[]; canReview: boolean; onChanged: () => void }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold text-ocean-950">Bayaran</h3>
      {payments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada bayaran dihantar.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {payments.map((p) => (
            <li key={p.id} className="space-y-3 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-ocean-950">
                    {PAYMENT_KIND_LABEL[p.kind]} &middot; <span className="tabular">{formatRM(p.amount)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ruj: {p.reference} &middot; {formatDateTime(p.created_at)}
                  </p>
                  {p.review_note && <p className="mt-1 text-xs text-muted-foreground">Nota: {p.review_note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <PaymentStatusBadge status={p.status} />
                  {p.receipt_path && (
                    <Button size="sm" variant="ghost" onClick={() => openReceipt(p.receipt_path)}>
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Resit
                    </Button>
                  )}
                </div>
              </div>
              {canReview && p.status === 'PENDING' && <PaymentReviewActions payment={p} onDone={onChanged} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
