'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowUpRight, BedDouble, CalendarClock, ChevronRight, Hourglass, LogIn, Receipt, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/shell/stat-card';
import { SparkCard, ActionCard } from '@/components/shell/spark-card';
import { CommandPalette } from '@/components/shell/command-palette';
import { PageHeader } from '@/components/shell/app-shell';
import { HoldCountdown } from '@/components/booking/hold-countdown';
import { supabase } from '@/lib/supabase';
import { BOOKING_LIST_SELECT, hasPendingPayment, isHoldLapsed } from '@/lib/bookings';
import { balanceOf } from '@/lib/bookings';
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

  const holds = useMemo(() => (active ?? []).filter((b) => !isHoldLapsed(b, hasPendingPayment(b.payments ?? [])) && !hasPendingPayment(b.payments ?? [])), [active]);

  return (
    <>
      <div className="mb-6 hidden items-center justify-between gap-4 sm:flex">
        <CommandPalette />
        <Button asChild variant="default" size="sm">
          <Link href="/admin/bookings"><Receipt className="mr-2 h-4 w-4" /> Semak Bayaran</Link>
        </Button>
      </div>

      <PageHeader title="Papan Pemuka Operasi" description="Gambaran masa nyata tempahan, bayaran dan ketibaan." />

      {failed ? (
        <p className="rounded-lg border border-surface-border bg-white p-8 text-center text-surface-muted">Gagal memuatkan data. Sila muat semula halaman.</p>
      ) : !active ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          {/* Action queue — payment reviews and expiring holds */}
          {(pendingCount > 0 || holds.length > 0) && (
            <section className="mb-6 rounded-lg border border-surface-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-semibold text-ocean-950">Barisan tindakan ({pendingCount + holds.length})</h2>
                </div>
                <span className="text-xs text-surface-muted">Semakan bayaran & hold hampir tamat</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {pending.slice(0, 2).map((p) => (
                  <Link key={p.id} href={p.bookings ? `/admin/bookings/${p.bookings.id}` : '/admin/payments'}>
                    <ActionCard
                      code={p.bookings?.code ?? '—'}
                      badgeLabel="Resit Perlu Disemak"
                      badgeClass="bg-amber-50 text-amber-800"
                      description={<>Ejen: <strong className="text-ocean-950">{p.bookings?.profiles?.company_name ?? '—'}</strong> · {PAYMENT_KIND_LABEL[p.kind]} · <strong className="text-ocean-950 tabular">{formatRM(p.amount)}</strong></>}
                      onClick={() => {}}
                    />
                  </Link>
                ))}
                {holds.slice(0, 2).map((b) => (
                  <Link key={b.id} href={`/admin/bookings/${b.id}`}>
                    <ActionCard
                      code={b.code}
                      badgeLabel="Hold Hampir Tamat"
                      badgeClass="bg-coral-50 text-coral-800"
                      description={<>Ejen: <strong className="text-ocean-950">{b.profiles?.company_name ?? '—'}</strong> · Deposit <strong className="text-ocean-950 tabular">{formatRM(b.deposit_required)}</strong></>}
                      onClick={() => {}}
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SparkCard icon={TrendingUp} label="Kutipan Disahkan (Bulan Ini)" value={formatRM(monthRevenue)} tone="green"
              delta="Bulan ini" deltaTone="muted"
              spark={[{v:1},{v:2},{v:1.5},{v:3},{v:2.5},{v:4},{v:3.5}].map((d,i) => ({ v: d.v * (monthRevenue / 4) * (0.6 + i*0.06) }))} />
            <SparkCard icon={Receipt} label="Resit Menunggu Semakan" value={pendingCount} tone="sand"
              hint={pendingCount === 0 ? 'Tiada resit baharu.' : 'Perlu pengesahan staf.'} />
            <SparkCard icon={Hourglass} label="Hold Aktif" value={holds.length} tone="coral"
              hint="Belum hantar resit deposit." />
            <SparkCard icon={LogIn} label="Ketibaan Hari Ini" value={arrivals} tone="ocean"
              hint="Tempahan disahkan." />
          </div>

          {/* Two panels: payment queue + hold expiry */}
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-surface-border bg-white">
              <div className="flex min-h-[56px] items-center justify-between gap-3 border-b border-surface-border px-5 py-3">
                <h2 className="font-semibold text-ocean-950">Resit menunggu semakan</h2>
                <Link href="/admin/payments" className="text-sm font-medium text-ocean-700 hover:underline">Buka barisan</Link>
              </div>
              <div className="divide-y divide-surface-border">
                {pending.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-surface-muted">Tiada resit baharu.</p>
                ) : pending.map((p) => (
                  <Link key={p.id} href={p.bookings ? `/admin/bookings/${p.bookings.id}` : '/admin/payments'}
                    className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ocean-950">{p.bookings?.code} <span className="font-normal text-surface-muted">· {p.bookings?.profiles?.company_name}</span></p>
                      <p className="text-sm text-surface-muted">{PAYMENT_KIND_LABEL[p.kind]} · {formatDateTime(p.created_at)}</p>
                    </div>
                    <span className="font-semibold tabular text-ocean-950">{formatRM(p.amount)}</span>
                    <ChevronRight className="h-4 w-4 text-surface-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-surface-border bg-white">
              <div className="flex min-h-[56px] items-center justify-between gap-3 border-b border-surface-border px-5 py-3">
                <h2 className="font-semibold text-ocean-950">Hold hampir tamat</h2>
              </div>
              <div className="divide-y divide-surface-border">
                {holds.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-surface-muted">Tiada hold aktif.</p>
                ) : holds.slice(0, 8).map((b) => (
                  <Link key={b.id} href={`/admin/bookings/${b.id}`} className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ocean-950">{b.code} <span className="font-normal text-surface-muted">· {b.profiles?.company_name}</span></p>
                      <p className="text-sm text-surface-muted">Deposit {formatRM(b.deposit_required)}</p>
                    </div>
                    <HoldCountdown expiresAt={b.hold_expires_at} />
                    <ChevronRight className="h-4 w-4 text-surface-muted transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
