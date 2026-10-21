'use client';

import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Stepper({
  value,
  min = 0,
  max,
  onChange,
  label,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const btn =
    'flex h-9 w-9 items-center justify-center rounded-lg border bg-background transition-colors hover:border-ocean-300 hover:bg-ocean-50 disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Kurangkan ${label}`}>
        <Minus className="h-4 w-4" />
      </button>
      <span className={cn('w-8 text-center font-semibold tabular', value > 0 ? 'text-ocean-950' : 'text-muted-foreground')}>{value}</span>
      <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label={`Tambah ${label}`}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
