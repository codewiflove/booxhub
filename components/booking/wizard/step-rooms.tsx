'use client';

import { BedDouble, Users } from 'lucide-react';
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
          return (
            <div
              key={q.room.id}
              className={cn(
                'grid overflow-hidden rounded-2xl border bg-card transition-all duration-300 sm:grid-cols-[200px_1fr]',
                qty > 0 ? 'border-ocean-400 shadow-lg shadow-ocean-900/5' : 'hover:border-ocean-200',
                soldOut && 'opacity-60'
              )}
            >
              <div className="relative h-40 sm:h-full">
                {q.room.image_url ? (
                  <img src={q.room.image_url} alt={q.room.name} className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-ocean-50"><BedDouble className="h-8 w-8 text-ocean-300" /></div>
                )}
                <span className={cn(
                  'absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold',
                  soldOut ? 'bg-slate-900/80 text-white' : q.minAvailable <= 2 ? 'bg-coral-600 text-white' : 'bg-white/90 text-ocean-900'
                )}>
                  {soldOut ? 'Penuh' : `${q.minAvailable} unit tersedia`}
                </span>
              </div>
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-ocean-950">{q.room.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{q.room.description}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Maks {q.room.max_adults} dewasa + {q.room.max_children} kanak-kanak
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {q.nights.map((n) => (
                      <span key={n.day} title={`${n.day}: ${SEASON_META[n.season].label}`}
                        className={cn('rounded-md border px-1.5 py-0.5 text-[11px] tabular', SEASON_META[n.season].className)}>
                        {n.day.slice(8)}/{n.day.slice(5, 7)} {formatRM(n.rate).replace('RM', '').trim()}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="font-display text-2xl text-ocean-950 tabular">{formatRM(q.perUnit)}</p>
                    <p className="text-xs text-muted-foreground">seunit, {q.nights.length} malam</p>
                  </div>
                  <Stepper label={q.room.name} value={qty} max={Math.max(0, q.minAvailable)}
                    onChange={(v) => update({ rooms: { ...state.rooms, [q.room.id]: v } })} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={cn('rounded-xl p-4 text-sm ring-1', capacity.ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-amber-200')}>
        {capacity.units === 0
          ? `Pilih bilik untuk ${guests} tetamu.`
          : capacity.ok
            ? `Kapasiti mencukupi: ${capacity.units} bilik untuk ${guests} tetamu.`
            : `Kapasiti belum mencukupi. Bilik dipilih memuatkan ${capacity.adults} dewasa / ${capacity.total} tetamu, anda ada ${state.adults} dewasa / ${guests} tetamu.`}
      </div>
    </div>
  );
}
