'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell/app-shell';
import { openReceipt, PaymentReviewActions } from '@/components/booking/payment-list';
import { supabase } from '@/lib/supabase';
import { formatDateTime, formatRM, PAYMENT_KIND_LABEL } from '@/lib/format';
import type { Payment } from '@/lib/types';

type QueueItem = Payment & {
  bookings: { id: string; code: string; grand_total: number; paid_amount: number; lead_guest_name: string; profiles: { company_name: string; full_name: string } | null } | null;
};

export default function PaymentsQueuePage() {
  const [rows, setRows] = useState<QueueItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('payments')
      .select('*, bookings(id, code, grand_total, paid_amount, lead_guest_name, profiles(company_name, full_name))')
      .eq('status', 'PENDING').order('created_at');
    if (error) { console.error(error); setFailed(true); return; }
    setRows((data ?? []) as unknown as QueueItem[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Semakan Bayaran" description="Sahkan resit pindahan bank. Tempahan dikemas kini serta-merta selepas pengesahan." />
      {failed ? (
        <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Gagal memuatkan barisan bayaran.</p>
      ) : !rows ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-card py-16 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="font-semibold text-ocean-950">Semua resit telah disemak</p>
          <p className="text-sm text-muted-foreground">Resit baharu daripada ejen akan muncul di sini.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((p) => (
            <li key={p.id} className="rounded-lg border bg-card p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {p.bookings && (
                      <Link href={`/admin/bookings/${p.bookings.id}`} className="font-semibold text-ocean-800 hover:underline">{p.bookings.code}</Link>
                    )}
                    <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-sand-800">{PAYMENT_KIND_LABEL[p.kind]}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.bookings?.profiles?.company_name} · Tetamu: {p.bookings?.lead_guest_name}
                  </p>
                  <p className="text-xs text-muted-foreground">Ruj: {p.reference} · Dihantar {formatDateTime(p.created_at)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-sans text-2xl tabular text-ocean-950">{formatRM(p.amount)}</p>
                    {p.bookings && <p className="text-xs text-muted-foreground">daripada {formatRM(p.bookings.grand_total)}</p>}
                  </div>
                  {p.receipt_path && (
                    <Button variant="outline" size="sm" onClick={() => openReceipt(p.receipt_path)}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Lihat resit
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-4 border-t pt-4">
                <PaymentReviewActions payment={p} onDone={load} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
