'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Hourglass, Loader2, LogIn, Receipt, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/shell/app-shell';
import { EmptyRow, Panel, StatCard } from '@/components/shell/stat-card';
import { HoldCountdown } from '@/components/booking/hold-countdown';
import { supabase } from '@/lib/supabase';
import { BOOKING_LIST_SELECT, hasPendingPayment, isHoldLapsed } from '@/lib/bookings';
import { formatDateTime, formatRM, malaysiaToday, PAYMENT_KIND_LABEL, toISODate } from '@/lib/format';
import type { Booking, PaymentKind } from '@/lib/types';

interface PendingPay {
  id: string; kind: PaymentKind; amount: number; created_at: string;
  bookings: { id: string; code: string; profiles: { company_name: string } | null } | null;
}

export default function AdminDashboard() {
  const [active, setActive] = useState<Booking[] | null>(null);
  const [pending, setPending] = useState<PendingPay[]>([]);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [arrivals, setArrivals] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const today = malaysiaToday();
      const todayISO = toISODate(today);
      const monthStart = `${todayISO.slice(0, 8)}01`;
      const [a, p, v, arr] = await Promise.all([
        supabase.from('bookings').select(BOOKING_LIST_SELECT).eq('status', 'PENDING_DEPOSIT').order('hold_expires_at'),
        supabase.from('payments').select('id, kind, amount, created_at, bookings(id, code, profiles(company_name))', { count: 'exact' })
          .eq('status', 'PENDING').order('created_at').limit(8),
        supabase.from('payments').select('amount').eq('status', 'VERIFIED').gte('reviewed_at', monthStart),
        supabase.from('bookings').select('id', { count: 'exact', head: true })
          .eq('check_in', todayISO).in('status', ['CONFIRMED_PARTIAL', 'FULLY_PAID']),
      ]);
      if (a.error || p.error || v.error || arr.error) { console.error(a.error || p.error || v.error || arr.error); setFailed(true); return; }
      setActive((a.data ?? []) as unknown as Booking[]);
      setPending((p.data ?? []) as unknown as PendingPay[]);
      setMonthRevenue((v.data ?? []).reduce((s, r) => s + Number(r.amount), 0));
      setArrivals(arr.count ?? 0);
      setPendingCount(p.count ?? 0);
    })();
  }, []);

  const holds = (active ?? []).filter((b) => !isHoldLapsed(b, hasPendingPayment(b.payments ?? [])) && !hasPendingPayment(b.payments ?? []));

  return (
    <>
      <PageHeader title="Papan Pemuka Operasi" description="Gambaran masa nyata tempahan, bayaran dan ketibaan." />
      {failed ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Gagal memuatkan data. Sila muat semula halaman.</p>
      ) : !active ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={TrendingUp} label="Kutipan disahkan bulan ini" value={formatRM(monthRevenue)} tone="green" />
            <StatCard icon={Receipt} label="Resit menunggu semakan" value={pendingCount} tone="sand" />
            <StatCard icon={Hourglass} label="Hold aktif" value={holds.length} hint="Belum hantar deposit" tone="coral" />
            <StatCard icon={LogIn} label="Ketibaan hari ini" value={arrivals} />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Panel title="Resit menunggu semakan"
              action={<Link href="/admin/payments" className="text-sm font-medium text-ocean-700 hover:underline">Buka barisan</Link>}>
              {pending.length === 0 ? <EmptyRow>Tiada resit baharu.</EmptyRow> : pending.map((p) => (
                <Link key={p.id} href={p.bookings ? `/admin/bookings/${p.bookings.id}` : '/admin/payments'}
                  className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ocean-950">{p.bookings?.code} <span className="font-normal text-muted-foreground">· {p.bookings?.profiles?.company_name}</span></p>
                    <p className="text-sm text-muted-foreground">{PAYMENT_KIND_LABEL[p.kind]} · {formatDateTime(p.created_at)}</p>
                  </div>
                  <span className="font-semibold tabular">{formatRM(p.amount)}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </Panel>
            <Panel title="Hold hampir tamat">
              {holds.length === 0 ? <EmptyRow>Tiada hold aktif.</EmptyRow> : holds.slice(0, 8).map((b) => (
                <Link key={b.id} href={`/admin/bookings/${b.id}`} className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ocean-950">{b.code} <span className="font-normal text-muted-foreground">· {b.profiles?.company_name}</span></p>
                    <p className="text-sm text-muted-foreground">Deposit {formatRM(b.deposit_required)}</p>
                  </div>
                  <HoldCountdown expiresAt={b.hold_expires_at} />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
