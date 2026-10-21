'use client';

import { Car, Lock, Ship, Waves } from 'lucide-react';
import { formatDate, formatRM } from '@/lib/format';
import type { computeTotals, RoomQuote, WizardState } from './wizard-model';

export function BookingSummary({
  state,
  quotes,
  totals,
  holdHours,
}: {
  state: WizardState;
  quotes: RoomQuote[];
  totals: ReturnType<typeof computeTotals>;
  holdHours: number | null;
}) {
  const selected = quotes.filter((q) => (state.rooms[q.room.id] ?? 0) > 0);
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ocean-600">Ringkasan</p>
      {state.checkIn && state.checkOut ? (
        <p className="mt-2 font-semibold text-ocean-950">
          {formatDate(state.checkIn, 'd MMM')} - {formatDate(state.checkOut, 'd MMM yyyy')}
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Pilih tarikh untuk bermula</p>
      )}
      <p className="text-sm text-muted-foreground">{state.adults} dewasa, {state.children} kanak-kanak</p>

      <div className="mt-5 space-y-2 border-t pt-4 text-sm">
        {selected.length === 0 && <p className="text-muted-foreground">Tiada bilik dipilih</p>}
        {selected.map((q) => (
          <div key={q.room.id} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{state.rooms[q.room.id]} x {q.room.name}</span>
            <span className="tabular">{formatRM(q.perUnit * state.rooms[q.room.id])}</span>
          </div>
        ))}
        {totals.boatTotal > 0 && (
          <div className="flex justify-between gap-3"><span className="flex items-center gap-1.5 text-muted-foreground"><Ship className="h-3.5 w-3.5" /> Speedboat</span><span className="tabular">{formatRM(totals.boatTotal)}</span></div>
        )}
        {totals.vanTotal > 0 && (
          <div className="flex justify-between gap-3"><span className="flex items-center gap-1.5 text-muted-foreground"><Car className="h-3.5 w-3.5" /> Van KBR</span><span className="tabular">{formatRM(totals.vanTotal)}</span></div>
        )}
        {totals.snorkelTotal > 0 && (
          <div className="flex justify-between gap-3"><span className="flex items-center gap-1.5 text-muted-foreground"><Waves className="h-3.5 w-3.5" /> Snorkeling</span><span className="tabular">{formatRM(totals.snorkelTotal)}</span></div>
        )}
      </div>

      <div className="mt-4 border-t pt-4">
        <div className="flex items-end justify-between">
          <span className="text-sm font-semibold text-ocean-950">Jumlah bersih</span>
          <span className="font-sans text-3xl text-ocean-950 tabular">{formatRM(totals.grand)}</span>
        </div>
        <div className="mt-3 flex justify-between rounded-xl bg-sand-50 px-4 py-3 text-sm ring-1 ring-sand-200">
          <span className="font-semibold text-sand-800">Deposit 25%</span>
          <span className="font-semibold tabular text-sand-900">{formatRM(totals.deposit)}</span>
        </div>
        {holdHours && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Bilik dikunci {holdHours} jam selepas dihantar
          </p>
        )}
      </div>
    </div>
  );
}
