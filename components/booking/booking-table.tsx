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
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'tap inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors',
                filter === f.key
                  ? 'bg-white text-ocean-700 shadow-stripe-card ring-1 ring-surface-border'
                  : 'text-surface-muted hover:bg-white/60 hover:text-ocean-950'
              )}
            >
              {f.label}
              {rows && (
                <span className={cn('rounded px-1.5 text-[11px] tabular', filter === f.key ? 'bg-ocean-50 text-ocean-700' : 'bg-surface text-surface-muted')}>
                  {counts[f.key] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative lg:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={viewer === 'staff' ? 'Kod, tetamu atau agensi' : 'Kod atau nama tetamu'} className="rounded-md bg-white pl-9" />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-surface-border bg-white p-10 text-center">
          <p className="text-sm font-semibold text-ocean-950">Senarai tidak dapat dimuatkan.</p>
          <Button variant="outline" className="mt-4" onClick={load}>Cuba lagi</Button>
        </div>
      ) : !rows ? (
        <SkeletonList rows={5} />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-surface-border bg-white">
          <EmptyState icon={Inbox} title={rows.length === 0 ? 'Belum ada tempahan' : 'Tiada padanan'}
            action={viewer === 'agent' && rows.length === 0 ? <Button asChild variant="default"><Link href="/portal/book">Buat tempahan pertama</Link></Button> : undefined}>
            {rows.length === 0 ? 'Tempahan yang dibuat akan dipaparkan di sini.' : 'Cuba tukar penapis status atau carian anda.'}
          </EmptyState>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {filtered.map((b) => {
              const st = effectiveStatus(b);
              const rooms = (b.booking_rooms ?? []).map((r) => `${r.quantity}x ${r.room_name}`).join(', ');
              const who = viewer === 'staff' ? b.profiles?.company_name : b.lead_guest_name || 'Tiada nama tetamu';
              const hold = st === 'PENDING_DEPOSIT' && (hasPendingPayment(b.payments ?? [])
                ? <span className="text-xs font-semibold text-amber-700">Resit sedang disemak</span>
                : <HoldCountdown expiresAt={b.hold_expires_at} />);
              return (
                <Link key={b.id} href={`${base}/${b.id}`}
                  className="tap block rounded-lg border border-surface-border bg-white p-4 transition-colors hover:bg-surface">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium text-ocean-950">{b.code}</p>
                      <p className="truncate text-sm text-surface-muted">{who}</p>
                    </div>
                    <StatusBadge status={st} />
                  </div>
                  <div className="mt-3 space-y-1.5 rounded-md bg-surface p-3 text-sm">
                    <p className="flex items-center gap-2 font-medium text-ocean-950">
                      <CalendarDays className="h-4 w-4 shrink-0 text-ocean-600" />
                      {formatDate(b.check_in, 'd MMM')} - {formatDate(b.check_out, 'd MMM yyyy')}
                    </p>
                    {rooms && (
                      <p className="flex items-center gap-2 text-surface-muted">
                        <BedDouble className="h-4 w-4 shrink-0 text-ocean-600" /><span className="truncate">{rooms}</span>
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>{hold}</div>
                    <p className="flex items-center gap-1 text-lg font-semibold tabular text-ocean-950">
                      {formatRM(b.grand_total)} <ChevronRight className="h-4 w-4 text-surface-muted" />
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-surface-border bg-white lg:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-surface-border bg-surface text-[11px] font-semibold uppercase tracking-wider text-surface-muted">
                    <th className="px-4 py-2.5">Kod & Tetamu</th>
                    <th className="px-4 py-2.5">Bilik</th>
                    <th className="px-4 py-2.5">Tarikh</th>
                    <th className="px-4 py-2.5">Jumlah</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border text-sm">
                  {filtered.map((b) => {
                    const st = effectiveStatus(b);
                    const rooms = (b.booking_rooms ?? []).map((r) => `${r.quantity}x ${r.room_name}`).join(', ');
                    const who = viewer === 'staff' ? b.profiles?.company_name : b.lead_guest_name || 'Tiada nama tetamu';
                    const hold = st === 'PENDING_DEPOSIT' && (hasPendingPayment(b.payments ?? [])
                      ? <span className="text-xs font-medium text-amber-700">Resit disemak</span>
                      : <HoldCountdown expiresAt={b.hold_expires_at} />);
                    return (
                      <Link key={b.id} href={`${base}/${b.id}`} className="contents">
                        <tr className="cursor-pointer transition-colors hover:bg-surface group">
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs font-medium text-ocean-950">{b.code}</p>
                            <p className="truncate text-sm text-surface-muted">{who}</p>
                          </td>
                          <td className="max-w-[200px] px-4 py-3">
                            <p className="truncate text-sm text-ocean-950">{rooms}</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm">
                            <p className="font-medium tabular text-ocean-950">{formatDate(b.check_in, 'd MMM')} → {formatDate(b.check_out, 'd MMM yyyy')}</p>
                            <p className="text-xs text-surface-muted">{b.nights} malam</p>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold tabular text-ocean-950">{formatRM(b.grand_total)}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-1">
                              <StatusBadge status={st} />
                              {hold}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <ChevronRight className="inline-block h-4 w-4 text-surface-muted transition-transform group-hover:translate-x-0.5" />
                          </td>
                        </tr>
                      </Link>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
