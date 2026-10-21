'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Inbox, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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

  const base = viewer === 'agent' ? '/portal/bookings' : '/admin/bookings';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
                filter === f.key ? 'bg-ocean-900 text-white' : 'bg-muted text-muted-foreground hover:bg-ocean-50 hover:text-ocean-900'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={viewer === 'staff' ? 'Kod, tetamu atau agensi' : 'Kod atau nama tetamu'} className="pl-9" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        {error ? (
          <div className="p-10 text-center">
            <p className="font-semibold">Senarai tidak dapat dimuatkan.</p>
            <Button variant="outline" className="mt-4" onClick={load}>Cuba lagi</Button>
          </div>
        ) : !rows ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="font-semibold text-ocean-950">Tiada tempahan</p>
            {viewer === 'agent' && (
              <Button asChild size="sm"><Link href="/portal/book">Buat tempahan pertama</Link></Button>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((b) => {
              const st = effectiveStatus(b);
              return (
                <li key={b.id}>
                  <Link href={`${base}/${b.id}`} className="group grid grid-cols-2 items-center gap-3 px-5 py-4 transition-colors hover:bg-ocean-50/40 md:grid-cols-[1.2fr_1.4fr_1fr_1fr_auto]">
                    <div>
                      <p className="font-semibold text-ocean-950">{b.code}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {viewer === 'staff' ? b.profiles?.company_name : b.lead_guest_name || 'Tiada nama tetamu'}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-ocean-950">{formatDate(b.check_in, 'd MMM')} - {formatDate(b.check_out, 'd MMM yyyy')}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {(b.booking_rooms ?? []).map((r) => `${r.quantity}x ${r.room_name}`).join(', ')}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular text-ocean-950">{formatRM(b.grand_total)}</p>
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={st} />
                      {st === 'PENDING_DEPOSIT' && (hasPendingPayment(b.payments ?? [])
                        ? <span className="text-xs font-semibold text-amber-700">Resit sedang disemak</span>
                        : <HoldCountdown expiresAt={b.hold_expires_at} />)}
                    </div>
                    <ChevronRight className="hidden h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 md:block" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
