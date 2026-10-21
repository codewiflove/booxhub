'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  CalendarDays,
  Car,
  Clock,
  FileText,
  Hourglass,
  Loader2,
  Plane,
  Ship,
  Ticket,
  Users,
  Waves,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth/auth-provider';
import { fetchBookingBundle, hasPendingPayment, isHoldLapsed, balanceOf } from '@/lib/bookings';
import { formatDate, formatDateTime, formatRM, VAN_LABEL } from '@/lib/format';
import type { Booking, BookingEvent, Payment } from '@/lib/types';
import { StatusBadge } from './badges';
import { HoldCountdown } from './hold-countdown';
import { BookingPricing } from './booking-pricing';
import { PaymentList } from './payment-list';
import { PaymentDialog } from './payment-dialog';
import { CancelBookingDialog, ExtendHoldDialog } from './booking-actions';

function InfoTile({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ocean-50 text-ocean-700">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-ocean-950">{value}</p>
      </div>
    </div>
  );
}

export function BookingDetail({ id, viewer }: { id: string; viewer: 'agent' | 'staff' }) {
  const { profile } = useAuth();
  const isSuper = profile?.role === 'super_admin';
  const [data, setData] = useState<{ booking: Booking | null; payments: Payment[]; events: BookingEvent[] } | null>(null);
  const [error, setError] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchBookingBundle(id));
      setError(false);
    } catch (e) {
      console.error('booking load failed', e);
      setError(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const backHref = viewer === 'agent' ? '/portal/bookings' : '/admin/bookings';

  if (error) {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center">
        <p className="font-semibold">Tempahan tidak dapat dimuatkan.</p>
        <Button variant="outline" className="mt-4" onClick={load}>Cuba lagi</Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-ocean-600" />
      </div>
    );
  }
  const { booking: b, payments, events } = data;
  if (!b) {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center">
        <p className="font-semibold">Tempahan tidak dijumpai.</p>
        <Button asChild variant="outline" className="mt-4"><Link href={backHref}>Kembali</Link></Button>
      </div>
    );
  }

  const pending = hasPendingPayment(payments);
  const lapsed = isHoldLapsed(b, pending);
  const status = lapsed ? 'EXPIRED' : b.status;
  const confirmed = b.status === 'CONFIRMED_PARTIAL' || b.status === 'FULLY_PAID';
  const canPay = viewer === 'agent' && !pending && !lapsed && (b.status === 'PENDING_DEPOSIT' || (b.status === 'CONFIRMED_PARTIAL' && balanceOf(b) > 0));
  const canAgentRelease = viewer === 'agent' && b.status === 'PENDING_DEPOSIT' && !lapsed;
  const canAdminCancel = viewer === 'staff' && isSuper && ['PENDING_DEPOSIT', 'CONFIRMED_PARTIAL', 'FULLY_PAID'].includes(b.status);
  const canExtend = viewer === 'staff' && isSuper && b.status === 'PENDING_DEPOSIT' && (!lapsed || pending);

  return (
    <div className="space-y-6">
      <Link href={backHref} className="no-print inline-flex items-center gap-1 text-sm font-semibold text-ocean-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Semua tempahan
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="animate-fade-up">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl text-ocean-950">{b.code}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-2 text-muted-foreground">
            {viewer === 'staff' && b.profiles ? `${b.profiles.company_name} · ` : ''}
            Dibuat {formatDateTime(b.created_at)}
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/print/${b.id}?doc=proforma`} target="_blank"><FileText className="mr-2 h-4 w-4" /> Proforma</Link>
          </Button>
          {confirmed ? (
            <Button asChild variant="outline">
              <Link href={`/print/${b.id}?doc=voucher`} target="_blank"><Ticket className="mr-2 h-4 w-4" /> Baucar Pelanggan</Link>
            </Button>
          ) : (
            <Button variant="outline" disabled title="Dibuka selepas deposit disahkan">
              <Ticket className="mr-2 h-4 w-4" /> Baucar (dikunci)
            </Button>
          )}
          {canExtend && <Button variant="outline" onClick={() => setExtendOpen(true)}><Hourglass className="mr-2 h-4 w-4" /> Lanjut Hold</Button>}
          {canAgentRelease && <Button variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-700" onClick={() => setCancelOpen(true)}>Lepaskan Bilik</Button>}
          {canAdminCancel && <Button variant="ghost" className="text-red-700 hover:bg-red-50 hover:text-red-700" onClick={() => setCancelOpen(true)}>Batalkan</Button>}
        </div>
      </div>

      {b.status === 'PENDING_DEPOSIT' && !lapsed && (
        <div className="no-print overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-sand-50 to-white p-6 ring-1 ring-amber-200">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <Clock className="h-4 w-4" /> {pending ? 'Resit sedang disemak, bilik kekal dikunci' : 'Bilik dikunci sementara untuk anda'}
              </p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                {pending
                  ? 'Staf kami akan mengesahkan bayaran anda secepat mungkin.'
                  : `Bayar deposit ${formatRM(b.deposit_required)} sebelum ${formatDateTime(b.hold_expires_at)} atau bilik akan dilepaskan secara automatik.`}
              </p>
              {b.requires_immediate_payment && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-coral-50 px-3 py-2 text-xs font-semibold text-coral-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Fungsi hold akaun ini disekat kerana tempahan terdahulu tamat tempoh. Bayaran segera diwajibkan.
                </p>
              )}
            </div>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {!pending && <HoldCountdown expiresAt={b.hold_expires_at} size="lg" onExpire={load} />}
              {canPay && <Button size="lg" className="h-12" onClick={() => setPayOpen(true)}>Bayar Deposit</Button>}
            </div>
          </div>
        </div>
      )}

      {lapsed && (
        <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-700 ring-1 ring-slate-200">
          Tempoh hold telah tamat dan bilik telah dilepaskan. Sila buat tempahan baharu jika masih diperlukan.
        </div>
      )}

      {b.status === 'CONFIRMED_PARTIAL' && (
        <div className="no-print flex flex-col gap-4 rounded-2xl bg-ocean-50/70 p-6 ring-1 ring-ocean-200 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-ocean-900">Deposit diterima. Bilik anda telah disahkan.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Baki {formatRM(balanceOf(b))} perlu dijelaskan sebelum {formatDate(b.balance_due_date)}.
              {pending && ' Resit baki sedang disemak.'}
            </p>
          </div>
          {canPay && <Button onClick={() => setPayOpen(true)}>Bayar Baki 75%</Button>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold text-ocean-950">Butiran penginapan</h3>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <InfoTile icon={CalendarDays} label="Check-in / Check-out" value={`${formatDate(b.check_in)} - ${formatDate(b.check_out)}`} />
              <InfoTile icon={Clock} label="Tempoh" value={`${b.nights} malam`} />
              <InfoTile icon={Users} label="Tetamu" value={`${b.adults} dewasa, ${b.children} kanak-kanak`} />
              <InfoTile icon={Users} label="Ketua rombongan" value={`${b.lead_guest_name || '-'}${b.lead_guest_phone ? ` (${b.lead_guest_phone})` : ''}`} />
            </div>
            <div className="mt-6 space-y-2">
              {(b.booking_rooms ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 font-semibold text-ocean-950"><BedDouble className="h-4 w-4 text-ocean-600" /> {r.quantity} x {r.room_name}</span>
                  <span className="tabular text-muted-foreground">{formatRM(r.subtotal)}</span>
                </div>
              ))}
            </div>
            {b.notes && <p className="mt-4 rounded-xl bg-sand-50 p-4 text-sm text-muted-foreground">{b.notes}</p>}
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold text-ocean-950">Pengangkutan & aktiviti</h3>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <InfoTile icon={Ship} label="Speedboat Kuala Besut" value={b.include_boat ? `Pergi-balik, ${b.boat_adult + b.boat_child} pax` : 'Tidak termasuk'} />
              <InfoTile icon={Car} label="Van KBR Airport" value={b.van_type === 'none' ? 'Tidak termasuk' : `${VAN_LABEL[b.van_type]}, ${b.van_adult + b.van_child} pax`} />
              {b.van_type !== 'none' && (
                <InfoTile icon={Plane} label="Penerbangan" value={`${b.flight_number || '-'} ${b.flight_arrival_time ? `· tiba ${b.flight_arrival_time}` : ''}`} />
              )}
              <InfoTile icon={Waves} label="Snorkeling" value={b.snorkel_adult + b.snorkel_child > 0 ? `${b.snorkel_adult + b.snorkel_child} peserta` : 'Tidak termasuk'} />
            </div>
          </div>

          <PaymentList payments={payments} canReview={viewer === 'staff'} onChanged={load} />
        </div>

        <div className="space-y-6">
          <BookingPricing booking={b} />
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="font-semibold text-ocean-950">Sejarah</h3>
            <ol className="mt-4 space-y-4 border-l pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-ocean-500 ring-4 ring-ocean-50" />
                  <p className="text-sm text-ocean-950">{e.detail}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {canPay && <PaymentDialog booking={b} open={payOpen} onOpenChange={setPayOpen} onSubmitted={load} />}
      {(canAgentRelease || canAdminCancel) && (
        <CancelBookingDialog booking={b} open={cancelOpen} onOpenChange={setCancelOpen} asAgent={viewer === 'agent'} onDone={load} />
      )}
      {canExtend && <ExtendHoldDialog booking={b} open={extendOpen} onOpenChange={setExtendOpen} onDone={load} />}
    </div>
  );
}
