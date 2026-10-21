'use client';

import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { holdHoursFor, toISODate, malaysiaToday } from '@/lib/format';
import { Stepper } from './stepper';
import type { WizardState } from './wizard-model';

export function StepDates({
  state,
  update,
  holdBlocked,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  holdBlocked: boolean;
}) {
  const today = toISODate(malaysiaToday());
  const nights = state.checkIn && state.checkOut ? differenceInCalendarDays(parseISO(state.checkOut), parseISO(state.checkIn)) : 0;
  const hold = state.checkIn ? (holdBlocked ? 1 : holdHoursFor(state.checkIn)) : null;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ci">Tarikh check-in</Label>
          <Input id="ci" type="date" min={today} value={state.checkIn} className="h-12"
            onChange={(e) => {
              const ci = e.target.value;
              const co = state.checkOut && state.checkOut > ci ? state.checkOut : '';
              update({ checkIn: ci, checkOut: co, rooms: {} });
            }} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="co">Tarikh check-out</Label>
          <Input id="co" type="date" min={state.checkIn || today} value={state.checkOut} className="h-12"
            onChange={(e) => update({ checkOut: e.target.value, rooms: {} })} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="font-semibold text-ocean-950">Dewasa</p>
            <p className="text-xs text-muted-foreground">12 tahun ke atas</p>
          </div>
          <Stepper label="dewasa" value={state.adults} min={1} max={200}
            onChange={(v) => update({ adults: v, snorkelAdult: Math.min(state.snorkelAdult, v) })} />
        </div>
        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="font-semibold text-ocean-950">Kanak-kanak</p>
            <p className="text-xs text-muted-foreground">2 hingga 11 tahun</p>
          </div>
          <Stepper label="kanak-kanak" value={state.children} max={200}
            onChange={(v) => update({ children: v, snorkelChild: Math.min(state.snorkelChild, v) })} />
        </div>
      </div>

      {nights > 30 && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Maksimum 30 malam bagi satu tempahan.</p>}

      {hold && nights > 0 && (
        <div className="flex gap-3 rounded-xl bg-ocean-50/70 p-4 text-sm ring-1 ring-ocean-100">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ocean-700" />
          <p className="text-ocean-900">
            {nights} malam. Bilik akan dikunci selama <strong>{hold} jam</strong> selepas tempahan dihantar.
            {holdBlocked
              ? ' Akaun anda diwajibkan membayar deposit serta-merta kerana tempahan terdahulu tamat tempoh.'
              : hold === 1
                ? ' Tempahan saat akhir: sediakan bayaran deposit dengan segera.'
                : ''}
          </p>
        </div>
      )}
    </div>
  );
}
