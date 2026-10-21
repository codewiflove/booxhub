'use client';

import { useEffect, useState } from 'react';
import { addDays, parseISO } from 'date-fns';
import { Car, ChevronLeft, ChevronRight, Loader2, LogIn, LogOut, Printer, Ship } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shell/app-shell';
import { supabase } from '@/lib/supabase';
import { formatDate, malaysiaToday, toISODate, VAN_LABEL } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { cn } from '@/lib/utils';

const SELECT = 'id, code, status, check_in, check_out, nights, adults, children, lead_guest_name, lead_guest_phone, notes, include_boat, boat_adult, boat_child, van_type, van_adult, van_child, flight_number, flight_arrival_time, booking_rooms(id, room_name, quantity), profiles(company_name, phone)';

function Section({ icon: Icon, title, count, children }: { icon: typeof Ship; title: string; count: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid rounded-2xl border bg-card shadow-sm print:rounded-none print:shadow-none">
      <div className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-ocean-950"><Icon className="h-4 w-4 text-ocean-600" /> {title}</h2>
        <span className="text-sm font-medium text-muted-foreground">{count}</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const th = 'px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground';
const td = 'px-4 py-3 align-top';

function rooms(b: Booking) {
  return (b.booking_rooms ?? []).map((r) => `${r.quantity}x ${r.room_name}`).join(', ');
}

export default function OperationsPage() {
  const [day, setDay] = useState(toISODate(malaysiaToday()));
  const [arrivals, setArrivals] = useState<Booking[] | null>(null);
  const [departures, setDepartures] = useState<Booking[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setArrivals(null);
    (async () => {
      const [a, d] = await Promise.all([
        supabase.from('bookings').select(SELECT).eq('check_in', day).in('status', ['CONFIRMED_PARTIAL', 'FULLY_PAID']).order('flight_arrival_time'),
        supabase.from('bookings').select(SELECT).eq('check_out', day).in('status', ['CONFIRMED_PARTIAL', 'FULLY_PAID']).order('code'),
      ]);
      if (cancelled) return;
      if (a.error || d.error) { console.error(a.error || d.error); setFailed(true); return; }
      setFailed(false);
      setArrivals((a.data ?? []) as unknown as Booking[]);
      setDepartures((d.data ?? []) as unknown as Booking[]);
    })();
    return () => { cancelled = true; };
  }, [day]);

  const shift = (n: number) => setDay(toISODate(addDays(parseISO(day), n)));
  const pax = (list: Booking[]) => list.reduce((s, b) => s + b.adults + b.children, 0);
  const boatIn = (arrivals ?? []).filter((b) => b.include_boat);
  const boatOut = departures.filter((b) => b.include_boat);
  const vans = (arrivals ?? []).filter((b) => b.van_type !== 'none');
  const vansOut = departures.filter((b) => b.van_type === 'return');

  return (
    <>
      <div className="no-print">
        <PageHeader title="Operasi Harian" description="Senarai ketibaan, pelepasan dan manifest bot serta van untuk pasukan jeti."
          actions={<Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Cetak</Button>} />
        <div className="mb-6 flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Hari sebelum" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-10 w-auto" />
          <Button variant="outline" size="icon" aria-label="Hari seterusnya" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" onClick={() => setDay(toISODate(malaysiaToday()))}>Hari ini</Button>
        </div>
      </div>
      <h1 className="mb-4 hidden font-display text-2xl print:block">Manifest Operasi · {formatDate(day, 'EEEE, d MMMM yyyy')}</h1>

      {failed ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Gagal memuatkan data operasi.</p>
      ) : !arrivals ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Section icon={Ship} title="Bot masuk (Kuala Besut → Pulau)" count={`${pax(boatIn)} pax`}>
              <p className="px-5 py-4 text-sm text-muted-foreground">{boatIn.length} tempahan · {boatIn.reduce((s, b) => s + b.boat_adult, 0)} dewasa, {boatIn.reduce((s, b) => s + b.boat_child, 0)} kanak-kanak</p>
            </Section>
            <Section icon={Ship} title="Bot keluar (Pulau → Kuala Besut)" count={`${pax(boatOut)} pax`}>
              <p className="px-5 py-4 text-sm text-muted-foreground">{boatOut.length} tempahan · {boatOut.reduce((s, b) => s + b.boat_adult, 0)} dewasa, {boatOut.reduce((s, b) => s + b.boat_child, 0)} kanak-kanak</p>
            </Section>
          </div>

          <Section icon={LogIn} title="Ketibaan" count={`${arrivals.length} tempahan · ${pax(arrivals)} pax`}>
            {arrivals.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Tiada ketibaan.</p> : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30"><tr><th className={th}>Kod</th><th className={th}>Tetamu</th><th className={th}>Agensi</th><th className={th}>Bilik</th><th className={th}>Pax</th><th className={th}>Bot</th><th className={th}>Nota</th></tr></thead>
                <tbody className="divide-y">
                  {arrivals.map((b) => (
                    <tr key={b.id}>
                      <td className={cn(td, 'font-semibold text-ocean-900')}>{b.code}</td>
                      <td className={td}>{b.lead_guest_name}<p className="text-xs text-muted-foreground">{b.lead_guest_phone}</p></td>
                      <td className={td}>{b.profiles?.company_name}</td>
                      <td className={td}>{rooms(b)}<p className="text-xs text-muted-foreground">{b.nights} malam</p></td>
                      <td className={cn(td, 'tabular')}>{b.adults}D {b.children}K</td>
                      <td className={td}>{b.include_boat ? 'Ya' : '-'}</td>
                      <td className={cn(td, 'max-w-[220px] text-muted-foreground')}>{b.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section icon={Car} title="Van KBR (ambil di lapangan terbang)" count={`${pax(vans)} pax`}>
            {vans.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Tiada pengambilan van.</p> : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30"><tr><th className={th}>Masa tiba</th><th className={th}>Penerbangan</th><th className={th}>Tetamu</th><th className={th}>Pax</th><th className={th}>Jenis</th></tr></thead>
                <tbody className="divide-y">
                  {vans.map((b) => (
                    <tr key={b.id}>
                      <td className={cn(td, 'font-semibold tabular')}>{b.flight_arrival_time || '-'}</td>
                      <td className={td}>{b.flight_number || '-'}</td>
                      <td className={td}>{b.lead_guest_name} <span className="text-muted-foreground">({b.code})</span><p className="text-xs text-muted-foreground">{b.lead_guest_phone}</p></td>
                      <td className={cn(td, 'tabular')}>{b.van_adult}D {b.van_child}K</td>
                      <td className={td}>{VAN_LABEL[b.van_type]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section icon={LogOut} title="Pelepasan" count={`${departures.length} tempahan · ${pax(departures)} pax`}>
            {departures.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Tiada pelepasan.</p> : (
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30"><tr><th className={th}>Kod</th><th className={th}>Tetamu</th><th className={th}>Bilik</th><th className={th}>Pax</th><th className={th}>Bot</th><th className={th}>Van ke KBR</th></tr></thead>
                <tbody className="divide-y">
                  {departures.map((b) => (
                    <tr key={b.id}>
                      <td className={cn(td, 'font-semibold text-ocean-900')}>{b.code}</td>
                      <td className={td}>{b.lead_guest_name}</td>
                      <td className={td}>{rooms(b)}</td>
                      <td className={cn(td, 'tabular')}>{b.adults}D {b.children}K</td>
                      <td className={td}>{b.include_boat ? 'Ya' : '-'}</td>
                      <td className={td}>{vansOut.includes(b) ? 'Ya' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>
      )}
    </>
  );
}
