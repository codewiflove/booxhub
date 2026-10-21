'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { CalendarClock, ChevronRight, Hourglass, Loader2, Plus, ShieldAlert, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell/app-shell';
import { EmptyRow, Panel, StatCard } from '@/components/shell/stat-card';
import { useAuth } from '@/components/auth/auth-provider';
import { StatusBadge } from '@/components/booking/badges';
import { HoldCountdown } from '@/components/booking/hold-countdown';
import { supabase } from '@/lib/supabase';
import { BOOKING_LIST_SELECT, balanceOf, hasPendingPayment, isHoldLapsed } from '@/lib/bookings';
import { formatDate, formatRM, malaysiaToday } from '@/lib/format';
import type { Booking } from '@/lib/types';

function BookingLink({ b, children }: { b: Booking; children: React.ReactNode }) {
  return (
    <Link href={`/portal/bookings/${b.id}`} className="group flex items-center gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/60">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ocean-950">{b.code} <span className="font-normal text-muted-foreground">· {b.lead_guest_name}</span></p>
        <p className="text-sm text-muted-foreground">{formatDate(b.check_in, 'd MMM')} - {formatDate(b.check_out, 'd MMM yyyy')}</p>
      </div>
      {children}
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function AgentDashboard() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('bookings').select(BOOKING_LIST_SELECT)
        .order('created_at', { ascending: false }).limit(200);
      if (error) { console.error(error); setFailed(true); return; }
      setRows((data ?? []) as unknown as Booking[]);
    })();
  }, []);

  const today = malaysiaToday();
  const holds = (rows ?? []).filter((b) => b.status === 'PENDING_DEPOSIT' && !isHoldLapsed(b, hasPendingPayment(b.payments ?? [])));
  const balances = (rows ?? []).filter((b) => b.status === 'CONFIRMED_PARTIAL')
    .sort((a, b) => a.balance_due_date.localeCompare(b.balance_due_date));
  const upcoming = (rows ?? []).filter((b) => ['CONFIRMED_PARTIAL', 'FULLY_PAID'].includes(b.status)
    && differenceInCalendarDays(parseISO(b.check_in), today) >= 0);
  const outstanding = balances.reduce((s, b) => s + balanceOf(b), 0);

  return (
    <>
      <PageHeader
        title={`Selamat datang, ${profile?.full_name?.split(' ')[0] ?? ''}`}
        description={profile?.company_name ? `Ringkasan tempahan untuk ${profile.company_name}.` : undefined}
        actions={<Button asChild><Link href="/portal/book"><Plus className="mr-2 h-4 w-4" /> Tempahan Baharu</Link></Button>}
      />

      {profile?.hold_blocked && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-coral-200 bg-coral-50 p-4 text-sm text-coral-800">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Akaun anda telah melepasi had 3 tempahan tamat tempoh berturut-turut. Tempahan baharu hanya dikunci selama 1 jam dan perlu dibayar segera. Sila hubungi pihak admin untuk menarik balik sekatan ini.</p>
        </div>
      )}

      {failed ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Gagal memuatkan tempahan. Sila muat semula halaman.</p>
      ) : !rows ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard icon={Hourglass} label="Hold aktif" value={holds.length} hint="Perlu deposit sebelum tamat" tone="sand" />
            <StatCard icon={Wallet} label="Baki tertunggak" value={formatRM(outstanding)} hint={`${balances.length} tempahan`} tone="coral" />
            <StatCard icon={CalendarClock} label="Ketibaan akan datang" value={upcoming.length} hint="Tempahan disahkan" tone="green" />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Panel title="Hold menunggu deposit">
              {holds.length === 0 ? <EmptyRow>Tiada hold aktif.</EmptyRow> : holds.map((b) => (
                <BookingLink key={b.id} b={b}>
                  {hasPendingPayment(b.payments ?? [])
                    ? <span className="text-xs font-medium text-sand-800">Resit disemak</span>
                    : <HoldCountdown expiresAt={b.hold_expires_at} />}
                </BookingLink>
              ))}
            </Panel>
            <Panel title="Baki perlu dibayar">
              {balances.length === 0 ? <EmptyRow>Tiada baki tertunggak.</EmptyRow> : balances.map((b) => (
                <BookingLink key={b.id} b={b}>
                  <div className="text-right">
                    <p className="font-semibold tabular text-ocean-950">{formatRM(balanceOf(b))}</p>
                    <p className="text-xs text-muted-foreground">Sebelum {formatDate(b.balance_due_date, 'd MMM')}</p>
                  </div>
                </BookingLink>
              ))}
            </Panel>
          </div>

          <Panel title="Tempahan terkini" className="mt-6"
            action={<Link href="/portal/bookings" className="text-sm font-medium text-ocean-700 hover:underline">Lihat semua</Link>}>
            {rows.length === 0 ? <EmptyRow>Belum ada tempahan. Mulakan tempahan pertama anda.</EmptyRow> : rows.slice(0, 6).map((b) => (
              <BookingLink key={b.id} b={b}>
                <span className="hidden font-medium tabular sm:block">{formatRM(b.grand_total)}</span>
                <StatusBadge status={isHoldLapsed(b, hasPendingPayment(b.payments ?? [])) ? 'EXPIRED' : b.status} />
              </BookingLink>
            ))}
          </Panel>
        </>
      )}
    </>
  );
}
