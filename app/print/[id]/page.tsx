'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Car, Loader2, Lock, Printer, Sailboat, Ship, Waves } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RequireRole } from '@/components/auth/require-role';
import { useAuth } from '@/components/auth/auth-provider';
import { BookingPricing } from '@/components/booking/booking-pricing';
import { fetchBookingBundle } from '@/lib/bookings';
import { COMPANY } from '@/lib/company';
import { formatDate, formatDateTime, STATUS_META, VAN_LABEL } from '@/lib/format';
import type { Booking } from '@/lib/types';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-900">{children}</div>
    </div>
  );
}

function StayFacts({ b }: { b: Booking }) {
  return (
    <div className="grid gap-5 sm:grid-cols-4">
      <Field label="Check-in">{formatDate(b.check_in, 'EEE, d MMM yyyy')}<p className="text-xs font-normal text-slate-500">Dari 2:00 petang</p></Field>
      <Field label="Check-out">{formatDate(b.check_out, 'EEE, d MMM yyyy')}<p className="text-xs font-normal text-slate-500">Sebelum 12:00 tengah hari</p></Field>
      <Field label="Tempoh">{b.nights} malam</Field>
      <Field label="Tetamu">{b.adults} dewasa, {b.children} kanak-kanak</Field>
    </div>
  );
}

function Proforma({ b }: { b: Booking }) {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ocean-700 text-white"><Sailboat className="h-6 w-6" /></span>
          <div>
            <p className="font-display text-xl text-ocean-950">{COMPANY.legalName}</p>
            <p className="text-xs text-slate-500">{COMPANY.address}</p>
            <p className="text-xs text-slate-500">{COMPANY.phone} · {COMPANY.email}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl text-ocean-950">Invois Proforma</p>
          <p className="text-sm text-slate-600">No. {b.code}</p>
          <p className="text-xs text-slate-500">Tarikh: {formatDateTime(b.created_at)}</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">Status: {STATUS_META[b.status].label}</p>
        </div>
      </header>
      <section className="grid gap-6 border-b py-6 sm:grid-cols-2">
        <Field label="Dibilkan kepada">
          {b.profiles?.company_name}
          <p className="text-xs font-normal text-slate-500">{b.profiles?.full_name} · {b.profiles?.phone}</p>
          <p className="text-xs font-normal text-slate-500">{b.profiles?.email}</p>
        </Field>
        <Field label="Ketua rombongan">{b.lead_guest_name}<p className="text-xs font-normal text-slate-500">{b.lead_guest_phone}</p></Field>
      </section>
      <section className="border-b py-6"><StayFacts b={b} /></section>
      <section className="py-6"><BookingPricing booking={b} /></section>
      <section className="rounded-2xl border border-ocean-200 bg-ocean-50/60 p-5 text-sm">
        <p className="font-semibold text-ocean-950">Butiran bayaran</p>
        <p className="mt-2 text-slate-700">{COMPANY.bank.name} · {COMPANY.bank.account} · {COMPANY.bank.holder}</p>
        <p className="mt-1 text-slate-700">Sila nyatakan rujukan <strong>{b.code}</strong> dan muat naik resit di portal ejen.</p>
        <p className="mt-3 text-xs text-slate-500">
          Deposit 25% diperlukan untuk mengesahkan tempahan. Baki 75% perlu dijelaskan sebelum {formatDate(b.balance_due_date)}. Harga adalah kadar bersih ejen dan sulit.
        </p>
      </section>
    </>
  );
}

function Voucher({ b }: { b: Booking }) {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-6 border-b pb-6">
        <div>
          <p className="font-display text-2xl text-slate-900">{b.profiles?.company_name}</p>
          <p className="text-xs text-slate-500">{b.profiles?.phone} · {b.profiles?.email}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl text-slate-900">Baucar Penginapan</p>
          <p className="text-sm text-slate-600">Ruj. {b.code}</p>
        </div>
      </header>
      <section className="border-b py-6">
        <Field label="Nama tetamu">{b.lead_guest_name}{b.lead_guest_phone && <span className="font-normal text-slate-500"> · {b.lead_guest_phone}</span>}</Field>
      </section>
      <section className="border-b py-6">
        <Field label="Penginapan">
          {COMPANY.name}
          <p className="text-xs font-normal text-slate-500">{COMPANY.address}</p>
        </Field>
        <ul className="mt-4 space-y-1 text-sm text-slate-800">
          {(b.booking_rooms ?? []).map((r) => <li key={r.id}>{r.quantity} x {r.room_name}</li>)}
        </ul>
      </section>
      <section className="border-b py-6"><StayFacts b={b} /></section>
      <section className="grid gap-5 border-b py-6 sm:grid-cols-3">
        <Field label="Speedboat">
          <span className="flex items-center gap-1.5"><Ship className="h-4 w-4 text-slate-500" /> {b.include_boat ? 'Termasuk (pergi-balik)' : 'Tidak termasuk'}</span>
        </Field>
        <Field label="Van lapangan terbang">
          <span className="flex items-center gap-1.5"><Car className="h-4 w-4 text-slate-500" /> {b.van_type === 'none' ? 'Tidak termasuk' : VAN_LABEL[b.van_type]}</span>
          {b.van_type !== 'none' && <p className="text-xs font-normal text-slate-500">{b.flight_number} {b.flight_arrival_time && `· tiba ${b.flight_arrival_time}`}</p>}
        </Field>
        <Field label="Snorkeling">
          <span className="flex items-center gap-1.5"><Waves className="h-4 w-4 text-slate-500" /> {b.snorkel_adult + b.snorkel_child > 0 ? `${b.snorkel_adult} dewasa, ${b.snorkel_child} kanak-kanak` : 'Tidak termasuk'}</span>
        </Field>
      </section>
      {b.notes && <section className="border-b py-6"><Field label="Nota">{b.notes}</Field></section>}
      <section className="py-6 text-xs leading-relaxed text-slate-500">
        Sila tunjukkan baucar ini di kaunter jeti Kuala Besut dan semasa daftar masuk.
      </section>
    </>
  );
}

function PrintInner({ id, doc }: { id: string; doc: 'proforma' | 'voucher' }) {
  const { profile } = useAuth();
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const { booking } = await fetchBookingBundle(id);
        setBooking(booking);
      } catch (e) {
        console.error(e);
        setBooking(null);
      }
    })();
  }, [id]);

  const back = profile?.role === 'agent' ? `/portal/bookings/${id}` : `/admin/bookings/${id}`;
  const confirmed = booking && ['CONFIRMED_PARTIAL', 'FULLY_PAID'].includes(booking.status);

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-6 flex max-w-3xl items-center justify-between px-4">
        <Button variant="ghost" asChild><Link href={back}><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link></Button>
        {booking && (doc === 'proforma' || confirmed) && (
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak / Simpan PDF</Button>
        )}
      </div>
      <div className="mx-auto max-w-3xl bg-white p-8 shadow-sm sm:rounded-2xl sm:p-12 print:max-w-none print:p-0 print:shadow-none">
        {booking === undefined ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
        ) : booking === null ? (
          <p className="py-20 text-center text-slate-500">Tempahan tidak dijumpai.</p>
        ) : doc === 'voucher' && !confirmed ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Lock className="h-8 w-8 text-slate-400" />
            <p className="font-semibold text-slate-900">Baucar belum tersedia</p>
            <p className="max-w-sm text-sm text-slate-500">Baucar tetamu hanya boleh dijana selepas deposit disahkan.</p>
          </div>
        ) : doc === 'voucher' ? <Voucher b={booking} /> : <Proforma b={booking} />}
      </div>
    </div>
  );
}

export default function PrintPage({ params, searchParams }: { params: { id: string }; searchParams: { doc?: string } }) {
  return (
    <RequireRole roles={['agent', 'ops_admin', 'super_admin']}>
      <PrintInner id={params.id} doc={searchParams.doc === 'voucher' ? 'voucher' : 'proforma'} />
    </RequireRole>
  );
}
