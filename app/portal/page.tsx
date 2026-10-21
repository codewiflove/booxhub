'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import {
  AlertCircle, ArrowUpRight, BedDouble, CalendarClock, ChevronRight,
  Clock, FileBarChart2, Hourglass, Inbox, Plus, Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonList } from '@/components/shell/stat-card';
import { SparkCard, ActionCard } from '@/components/shell/spark-card';
import { CommandPalette } from '@/components/shell/command-palette';
import { SearchHero } from '@/components/booking/search-hero';
import { StatusBadge } from '@/components/booking/badges';
import { HoldCountdown } from '@/components/booking/hold-countdown';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/lib/supabase';
import { BOOKING_LIST_SELECT, balanceOf, hasPendingPayment, isHoldLapsed } from '@/lib/bookings';
import { formatDate, formatRM, malaysiaToday, STATUS_META } from '@/lib/format';
import type { Booking, BookingStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_TABS: { id: BookingStatus | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'Semua' },
  { id: 'PENDING_DEPOSIT', label: 'Menunggu Deposit' },
  { id: 'CONFIRMED_PARTIAL', label: 'Disahkan' },
  { id: 'FULLY_PAID', label: 'Dibayar Penuh' },
  { id: 'EXPIRED', label: 'Tamat Tempoh' },
];

export default function AgentDashboard() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'ALL'>('ALL');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('bookings').select(BOOKING_LIST_SELECT)
        .order('created_at', { ascending: false }).limit(200);
      if (error) { console.error(error); setFailed(true); return; }
      setRows((data ?? []) as unknown as Booking[]);
    })();
  }, []);

  const today = malaysiaToday();
  const holds = useMemo(() => (rows ?? []).filter((b) => b.status === 'PENDING_DEPOSIT' && !isHoldLapsed(b, hasPendingPayment(b.payments ?? [])) && !hasPendingPayment(b.payments ?? [])), [rows]);
  const balances = useMemo(() => (rows ?? []).filter((b) => b.status === 'CONFIRMED_PARTIAL').sort((a, b) => a.balance_due_date.localeCompare(b.balance_due_date)), [rows]);
  const active = useMemo(() => (rows ?? []).filter((b) => ['CONFIRMED_PARTIAL', 'FULLY_PAID'].includes(b.status)), [rows]);
  const overdue = useMemo(() => balances.filter((b) => b.balance_due_date < toISO(today)), [balances, today]);

  const totalGross = active.reduce((s, b) => s + Number(b.grand_total), 0);
  const totalOutstanding = balances.reduce((s, b) => s + balanceOf(b), 0);
  const confirmationRate = rows && rows.length > 0 ? Math.round((active.length / rows.length) * 100) : 100;
  const actionCount = holds.length + overdue.length;

  const filtered = (rows ?? []).filter((b) => statusFilter === 'ALL' ? true : b.status === statusFilter);

  if (profile?.hold_blocked) {
    // still show below, just with warning
  }

  return (
    <>
      <div className="mb-6 hidden items-center justify-between gap-4 sm:flex">
        <CommandPalette />
        <Button asChild variant="default" size="sm">
          <Link href="/portal/book"><Plus className="mr-2 h-4 w-4" /> Kunci Bilik Baharu</Link>
        </Button>
      </div>

      <SearchHero name={profile?.full_name?.split(' ')[0] ?? ''} company={profile?.company_name} />

      {profile?.hold_blocked && (
        <div className="mb-6 flex gap-3 rounded-lg border border-coral-200 bg-coral-50 p-4 text-sm text-coral-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Tempoh kunci bilik dihadkan kepada 1 jam. Sistem mengesan rekod tempahan tamat tempoh berulang. Sila muat naik resit deposit serta-merta untuk mengesahkan bilik.</p>
        </div>
      )}

      {failed ? (
        <p className="rounded-lg border border-surface-border bg-white p-8 text-center text-surface-muted">Gagal memuatkan tempahan. Sila muat semula halaman.</p>
      ) : !rows ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          {/* Action section — only appears when there are urgent items */}
          {actionCount > 0 && (
            <section className="mb-6 rounded-lg border border-surface-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <h2 className="text-sm font-semibold text-ocean-950">Perlu tindakan anda ({actionCount})</h2>
                </div>
                <span className="text-xs text-surface-muted">Selesaikan segera bagi mengelakkan kuota bilik terbatal</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {holds.slice(0, 2).map((b) => (
                  <Link key={b.id} href={`/portal/bookings/${b.id}`}>
                    <ActionCard
                      code={b.code}
                      badgeLabel="Menunggu Deposit 25%"
                      badgeClass="bg-amber-50 text-amber-800"
                      description={<>Tetamu: <strong className="text-ocean-950">{b.lead_guest_name || 'Belum diisi'}</strong> · Muat naik resit <strong className="text-ocean-950 tabular">{formatRM(b.deposit_required)}</strong> sebelum tempoh hold tamat.</>}
                      onClick={() => {}}
                    />
                  </Link>
                ))}
                {overdue.slice(0, 2).map((b) => (
                  <Link key={b.id} href={`/portal/bookings/${b.id}`}>
                    <ActionCard
                      code={b.code}
                      badgeLabel="Baki 75% Tertunggak"
                      badgeClass="bg-ocean-50 text-ocean-800"
                      description={<>Baki <strong className="text-ocean-950 tabular">{formatRM(balanceOf(b))}</strong> perlu dijelaskan sebelum <strong className="text-ocean-950">{formatDate(b.balance_due_date, 'd MMM yyyy')}</strong>.</>}
                      onClick={() => {}}
                    />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Metric cards with sparklines */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SparkCard icon={FileBarChart2} label="Jumlah Nilai Tempahan" value={formatRM(totalGross)} tone="ocean"
              delta={`${active.length} disahkan`} deltaTone="muted"
              spark={[{v:1},{v:2},{v:1.5},{v:3},{v:2.5},{v:4},{v:3.5}].map((d,i) => ({ v: d.v * (totalGross / 4) * (0.6 + i*0.06) }))} />
            <SparkCard icon={Hourglass} label="Bilik Dikunci (Hold)" value={holds.length} tone="sand"
              hint={holds.length === 0 ? 'Tiada bilik menunggu resit.' : 'Menunggu resit deposit 25%.'} />
            <SparkCard icon={Wallet} label="Baki Tertunggak (75%)" value={formatRM(totalOutstanding)} tone="coral"
              hint="Wajib dijelaskan 7 hari sebelum daftar masuk." />
            <SparkCard icon={CalendarClock} label="Kadar Pengesahan" value={`${confirmationRate}%`} tone="green"
              hint="Pastikan tiada 3 hold tamat berturut untuk kekalkan hold 48j." />
          </div>

          {/* Transaction table with status filter tabs */}
          <section className="mt-8 space-y-3">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-surface-border pb-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={cn(
                    'whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-colors',
                    statusFilter === tab.id ? 'bg-ocean-50 font-medium text-ocean-700' : 'text-surface-muted hover:text-ocean-950',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-surface-border bg-surface/50 p-12 text-center">
                <BedDouble className="mx-auto h-8 w-8 text-surface-muted" />
                <h3 className="mt-3 text-sm font-medium text-ocean-950">Belum ada tempahan untuk tempoh ini</h3>
                <p className="mx-auto mt-1 max-w-md text-xs text-surface-muted">
                  Semak ketersediaan bilik dan kunci kuota untuk pelanggan anda dengan deposit 25%.
                </p>
                <Button asChild className="mt-4" size="sm">
                  <Link href="/portal/book"><Plus className="mr-2 h-4 w-4" /> Kunci Bilik Pertama</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-surface-border bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-surface-border bg-surface text-[11px] font-semibold uppercase tracking-wider text-surface-muted">
                        <th className="px-4 py-2.5">Jumlah & Status</th>
                        <th className="px-4 py-2.5">Kod & Tetamu</th>
                        <th className="hidden px-4 py-2.5 md:table-cell">Bilik & Tambahan</th>
                        <th className="hidden px-4 py-2.5 sm:table-cell">Tarikh</th>
                        <th className="px-4 py-2.5">Tindakan Seterusnya</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border text-sm">
                      {filtered.slice(0, 20).map((b) => {
                        const pendingReceipt = hasPendingPayment(b.payments ?? []);
                        const lapsed = isHoldLapsed(b, pendingReceipt);
                        const displayStatus = lapsed ? 'EXPIRED' : b.status;
                        return (
                          <Link key={b.id} href={`/portal/bookings/${b.id}`} className="contents">
                            <tr className="cursor-pointer transition-colors hover:bg-surface group">
                              <td className="whitespace-nowrap px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <span className="font-medium tabular text-ocean-950">{formatRM(b.grand_total)}</span>
                                  <StatusBadge status={displayStatus} />
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-ocean-950">{b.lead_guest_name || 'Nama belum diisi'}</div>
                                <div className="font-mono text-xs text-surface-muted">{b.code}</div>
                              </td>
                              <td className="hidden px-4 py-3 md:table-cell">
                                <div className="max-w-[220px] truncate text-xs text-ocean-950">
                                  {(b.booking_rooms ?? []).map((r) => `${r.quantity}x ${r.room_name}`).join(', ')}
                                </div>
                              </td>
                              <td className="hidden whitespace-nowrap px-4 py-3 text-xs sm:table-cell">
                                <div className="font-medium tabular text-ocean-950">{formatDate(b.check_in)} → {formatDate(b.check_out)}</div>
                                <div className="text-surface-muted">{b.nights} malam</div>
                              </td>
                              <td className="px-4 py-3 text-xs text-surface-muted">
                                {b.status === 'PENDING_DEPOSIT' && !pendingReceipt && (
                                  <span className="inline-flex items-center gap-1.5 text-amber-700">
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    Bayar deposit <strong className="font-medium tabular">{formatRM(b.deposit_required)}</strong> sebelum hold tamat
                                  </span>
                                )}
                                {b.status === 'PENDING_DEPOSIT' && pendingReceipt && (
                                  <span className="inline-flex items-center gap-1.5 text-ocean-700">
                                    <HoldCountdown expiresAt={b.hold_expires_at} /> Resit disemak, bilik selamat
                                  </span>
                                )}
                                {b.status === 'CONFIRMED_PARTIAL' && (
                                  <span>Baki <strong className="font-medium tabular text-ocean-950">{formatRM(balanceOf(b))}</strong> sebelum {formatDate(b.balance_due_date, 'd MMM yyyy')}</span>
                                )}
                                {b.status === 'FULLY_PAID' && <span className="text-emerald-700">Selesai — sedia untuk daftar masuk</span>}
                                {(b.status === 'EXPIRED' || b.status === 'CANCELLED') && <span>Tiada tindakan diperlukan</span>}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <ArrowUpRight className="inline-block h-4 w-4 text-surface-muted transition-colors group-hover:text-ocean-600" />
                              </td>
                            </tr>
                          </Link>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {rows.length > 20 && (
            <div className="mt-4 text-center">
              <Button asChild variant="outline" size="sm">
                <Link href="/portal/bookings">Lihat semua {rows.length} tempahan <ChevronRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function toISO(d: Date) { return d.toISOString().slice(0, 10); }
