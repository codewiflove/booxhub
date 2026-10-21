'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { CalendarDays, Search, Users } from 'lucide-react';
import { Stepper } from '@/components/booking/wizard/stepper';
import { formatDate, malaysiaToday, toISODate } from '@/lib/format';
import { ISLAND_PHOTO } from '@/lib/media';

function DateField({ id, label, value, min, onChange }: {
  id: string; label: string; value: string; min: string; onChange: (v: string) => void;
}) {
  return (
    <label htmlFor={id} className="relative flex min-h-[52px] cursor-pointer flex-col justify-center rounded-lg bg-surface px-3 py-2 ring-1 ring-surface-border transition focus-within:ring-2 focus-within:ring-ocean-500 hover:bg-white">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-muted">{label}</span>
      <span className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ocean-950">
        <CalendarDays className="h-3.5 w-3.5 text-ocean-600" />
        {value ? formatDate(value, 'EEE, d MMM') : 'Pilih tarikh'}
      </span>
      <input id={id} type="date" min={min} value={value} onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0" />
    </label>
  );
}

export function SearchHero({ name, company }: { name: string; company?: string | null }) {
  const router = useRouter();
  const today = toISODate(malaysiaToday());
  const [checkIn, setCheckIn] = useState(toISODate(addDays(malaysiaToday(), 14)));
  const [checkOut, setCheckOut] = useState(toISODate(addDays(malaysiaToday(), 16)));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const nights = checkIn && checkOut ? differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn)) : 0;
  const valid = nights >= 1 && nights <= 30;

  const search = () => {
    const q = new URLSearchParams({ ci: checkIn, co: checkOut, a: String(adults), c: String(children) });
    router.push(`/portal/book?${q}`);
  };

  return (
    <section className="mb-6 sm:mb-8">
      <div className="relative h-28 overflow-hidden rounded-lg sm:h-32">
        <img src={ISLAND_PHOTO} alt="Pantai Pulau Perhentian" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/80 via-ocean-950/40 to-ocean-950/10" />
        <div className="absolute inset-0 flex flex-col justify-center p-4 sm:p-6">
          <p className="text-xs font-medium text-sand-200">Selamat datang, {name}</p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
            Ke mana pelanggan anda seterusnya?
          </h1>
          {company && <p className="mt-0.5 text-xs text-white/70">{company}</p>}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-surface-border bg-white p-3 shadow-stripe-card sm:p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.1fr_auto] md:items-stretch">
          <div className="grid grid-cols-2 gap-3 md:contents">
            <DateField id="hero-ci" label="Check-in" value={checkIn} min={today}
              onChange={(v) => { setCheckIn(v); if (checkOut <= v) setCheckOut(toISODate(addDays(parseISO(v), 1))); }} />
            <DateField id="hero-co" label="Check-out" value={checkOut} min={checkIn || today} onChange={setCheckOut} />
          </div>
          <div className="flex flex-col justify-center gap-2 rounded-lg bg-surface px-3 py-2 ring-1 ring-surface-border">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-ocean-950"><Users className="h-3.5 w-3.5 text-ocean-600" /> Dewasa</span>
              <Stepper label="dewasa" value={adults} min={1} max={200} onChange={setAdults} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="pl-5 text-sm font-medium text-ocean-950">Kanak-kanak</span>
              <Stepper label="kanak-kanak" value={children} max={200} onChange={setChildren} />
            </div>
          </div>
          <button type="button" onClick={search} disabled={!valid}
            className="tap flex h-12 items-center justify-center gap-2 rounded-lg bg-ocean-600 px-5 text-sm font-semibold text-white transition hover:bg-ocean-700 disabled:opacity-50 md:h-auto">
            <Search className="h-4 w-4" /> Cari Bilik
          </button>
        </div>
        <p className="mt-2.5 text-xs text-surface-muted">
          {valid ? `${nights} malam · ${adults + children} tetamu · Harga bersih ejen` : 'Sila pilih tarikh yang sah (1 hingga 30 malam).'}
        </p>
      </div>
    </section>
  );
}
