'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BedDouble, CalendarDays, ChevronRight, Inbox, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState, SkeletonList } from '@/components/shell/stat-card';
import { supabase } from '@/lib/supabase';
import { BOOKING_LIST_SELECT, hasPendingPayment, isHoldLapsed } from '@/lib/bookings';
import { formatDate, formatRM } from '@/lib/format';
import type { Booking, BookingStatus } from '@/lib/types';
import { StatusBadge } from './badges';
import { HoldCountdown } from './hold-countdown';
import { cn } from '@/lib/utils';

const FILTERS: { key: 'ALL' | BookingStatus; label: string }[] = [
  { key: 'ALL', label: 'Semua' },
  { key: 'PENDING_DEPOSIT', label: 'Menunggu Deposit' },
  { key: 'CONFIRMED_PARTIAL', label: 'Disahkan' },
  { key: 'FULLY_PAID', label: 'Dibayar Penuh' },
  { key: 'EXPIRED', label: 'Tamat Tempoh' },
  { key: 'CANCELLED', label: 'Dibatalkan' },
];

function effectiveStatus(b: Booking): BookingStatus {
  return isHoldLapsed(b, hasPendingPayment(b.payments ?? [])) ? 'EXPIRED' : b.status;
}

export function BookingTable({ viewer }: { viewer: 'agent' | 'staff' }) {
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<'ALL' | BookingStatus>('ALL');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('bookings')
      .select(BOOKING_LIST_SELECT)
      .order('created_at', { ascending: false })
      .limit(500);
    if (err) {
      console.error('bookings load failed', err);
      setError(true);
      return;
    }
    setError(false);
    setRows((data ?? []) as unknown as Booking[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((b) => {
      if (filter !== 'ALL' && effectiveStatus(b) !== filter) return false;
      if (!q) return true;
      return [b.code, b.lead_guest_name, b.profiles?.company_name ?? ''].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: rows?.length ?? 0 };
    for (const b of rows ?? []) { const s = effectiveStatus(b); c[s] = (c[s] ?? 0) + 1; }
    return c;
  }, [rows]);

  const base = viewer === 'agent' ? '/portal/bookings' : '/admin/bookings';

  return (
    <div className="space-y-4">
      <div className="flex flex-col-reverse gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'tap inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors',
                filter === f.key ? 'bg-ocean-900 text-white shadow-soft' : 'bg-white text-ocean-900/70 ring-1 ring-ocean-950/10 hover:bg-ocean-50'
              )}
            >
              {f.label}
              {rows && (
                <span className={cn('rounded-full px-1.5 text-[11px] tabular', filter === f.key ? 'bg-white/20' : 'bg-ocean-50 text-ocean-700')}>
                  {counts[f.key] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={viewer === 'staff' ? 'Kod, tetamu atau agensi' : 'Kod atau nama tetamu'} className="rounded-full bg-white pl-10" />
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border bg-card p-10 text-center">
          <p className="font-semibold">Senarai tidak dapat dimuatkan.</p>
          <Button variant="outline" className="mt-4" onClick={load}>Cuba lagi</Button>
        </div>
      ) : !rows ? (
        <SkeletonList rows={5} />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border bg-card">
          <EmptyState icon={Inbox} title={rows.length === 0 ? 'Belum ada tempahan' : 'Tiada padanan'}
            action={viewer === 'agent' && rows.length === 0 ? <Button asChild variant="cta"><Link href="/portal/book">Buat tempahan pertama</Link></Button> : undefined}>
            {rows.length === 0 ? 'Tempahan yang dibuat akan dipaparkan di sini.' : 'Cuba tukar penapis status atau carian anda.'}
          </EmptyState>
        </div>
      ) : (
        <ul className="space-y-3 md:space-y-0 md:divide-y md:overflow-hidden md:rounded-2xl md:border md:bg-card md:shadow-soft">
          {filtered.map((b) => {
            const st = effectiveStatus(b);
            const rooms = (b.booking_rooms ?? []).map((r) => `${r.quantity}x ${r.room_name}`).join(', ');
            const who = viewer === 'staff' ? b.profiles?.company_name : b.lead_guest_name || 'Tiada nama tetamu';
            const hold = st === 'PENDING_DEPOSIT' && (hasPendingPayment(b.payments ?? [])
              ? <span className="text-xs font-semibold text-amber-700">Resit sedang disemak</span>
              : <HoldCountdown expiresAt={b.hold_expires_at} />);
            return (
              <li key={b.id}>
                <Link href={`${base}/${b.id}`}
                  className="tap group block rounded-2xl border border-ocean-950/[0.06] bg-card p-4 shadow-soft transition-colors hover:bg-ocean-50/40 md:hidden">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-ocean-950">{b.code}</p>
                      <p className="truncate text-sm text-muted-foreground">{who}</p>
                    </div>
                    <StatusBadge status={st} />
                  </div>
                  <div className="mt-3 space-y-1.5 rounded-xl bg-ocean-50/50 p-3 text-sm">
                    <p className="flex items-center gap-2 font-medium text-ocean-950">
                      <CalendarDays className="h-4 w-4 shrink-0 text-ocean-600" />
                      {formatDate(b.check_in, 'd MMM')} - {formatDate(b.check_out, 'd MMM yyyy')}
                    </p>
                    {rooms && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <BedDouble className="h-4 w-4 shrink-0 text-ocean-600" /><span className="truncate">{rooms}</span>
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>{hold}</div>
                    <p className="flex items-center gap-1 font-display text-lg text-ocean-950 tabular">
                      {formatRM(b.grand_total)} <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </p>
                  </div>
                </Link>
                <Link href={`${base}/${b.id}`} className="group hidden grid-cols-[1.2fr_1.4fr_1fr_1fr_auto] items-center gap-3 px-5 py-4 transition-colors hover:bg-ocean-50/40 md:grid">
                  <div className="min-w-0">
                    <p className="font-semibold text-ocean-950">{b.code}</p>
                    <p className="truncate text-xs text-muted-foreground">{who}</p>
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-ocean-950">{formatDate(b.check_in, 'd MMM')} - {formatDate(b.check_out, 'd MMM yyyy')}</p>
                    <p className="truncate text-xs text-muted-foreground">{rooms}</p>
                  </div>
                  <p className="text-sm font-semibold tabular text-ocean-950">{formatRM(b.grand_total)}</p>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={st} />
                    {hold}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
