'use client';

import { BedDouble, Check, Flame, Users } from 'lucide-react';
import { formatRM, SEASON_META } from '@/lib/format';
import { cn } from '@/lib/utils';
import { SeasonBadge } from '../badges';
import { Stepper } from './stepper';
import type { RoomQuote, WizardState } from './wizard-model';

export function StepRooms({
  quotes,
  state,
  update,
  capacity,
}: {
  quotes: RoomQuote[];
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  capacity: { adults: number; total: number; units: number; ok: boolean };
}) {
  const seasons = Array.from(new Set(quotes.flatMap((q) => q.nights.map((n) => n.season))));
  const guests = state.adults + state.children;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        Musim terlibat: {seasons.map((s) => <SeasonBadge key={s} season={s} />)}
      </div>

      <div className="space-y-4">
        {quotes.map((q) => {
          const qty = state.rooms[q.room.id] ?? 0;
          const soldOut = q.minAvailable <= 0;
          const nightCount = q.nights.length || 1;
          return (
            <div
              key={q.room.id}
              className={cn(
                'grid overflow-hidden rounded-3xl border bg-card shadow-soft transition-all duration-300 sm:grid-cols-[220px_1fr]',
                qty > 0 ? 'border-ocean-500 ring-2 ring-ocean-500/20 shadow-lift' : 'border-ocean-950/[0.06] hover:shadow-lift',
                soldOut && 'opacity-60'
              )}
            >
              <div className="relative h-44 sm:h-full">
                {q.room.image_url ? (
                  <img src={q.room.image_url} alt={q.room.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-ocean-50 to-sand-50"><BedDouble className="h-10 w-10 text-ocean-300" /></div>
                )}
                <span className={cn(
                  'absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm',
                  soldOut ? 'bg-slate-900/80 text-white' : q.minAvailable <= 2 ? 'bg-coral-600 text-white' : 'bg-white/95 text-ocean-900'
                )}>
                  {!soldOut && q.minAvailable <= 2 && <Flame className="h-3.5 w-3.5" />}
                  {soldOut ? 'Penuh' : q.minAvailable <= 2 ? `Tinggal ${q.minAvailable} bilik!` : `${q.minAvailable} unit tersedia`}
                </span>
                {qty > 0 && (
                  <span className="absolute right-3 top-3 flex h-8 w-8 animate-fade-up items-center justify-center rounded-full bg-ocean-600 text-white shadow-md">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-snug text-ocean-950">{q.room.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{q.room.description}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-ocean-50 px-2.5 py-1 text-xs font-medium text-ocean-800">
                    <Users className="h-3.5 w-3.5" /> Maks {q.room.max_adults} dewasa + {q.room.max_children} kanak-kanak
                  </p>
                  <div className="-mx-1 mt-3 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-none sm:flex-wrap">
                    {q.nights.map((n) => (
                      <span key={n.day} title={`${n.day}: ${SEASON_META[n.season].label}`}
                        className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[11px] tabular', SEASON_META[n.season].className)}>
                        {n.day.slice(8)}/{n.day.slice(5, 7)} {formatRM(n.rate).replace('RM', '').trim()}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-row items-center justify-between gap-4 border-t pt-4 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                  <div className="sm:text-right">
                    <p className="font-display text-2xl text-ocean-950 tabular">
                      {formatRM(q.perUnit / nightCount)}<span className="font-sans text-sm font-medium text-muted-foreground"> /malam</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{formatRM(q.perUnit)} seunit, {q.nights.length} malam</p>
                  </div>
                  <Stepper label={q.room.name} value={qty} max={Math.max(0, q.minAvailable)}
                    onChange={(v) => update({ rooms: { ...state.rooms, [q.room.id]: v } })} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={cn('rounded-2xl p-4 text-sm ring-1', capacity.ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200')}>
        {capacity.units === 0
          ? `Pilih bilik untuk ${guests} tetamu.`
          : capacity.ok
            ? `Kapasiti mencukupi: ${capacity.units} bilik untuk ${guests} tetamu.`
            : `Kapasiti belum mencukupi. Bilik dipilih memuatkan ${capacity.adults} dewasa / ${capacity.total} tetamu, anda ada ${state.adults} dewasa / ${guests} tetamu.`}
      </div>
    </div>
  );
}
