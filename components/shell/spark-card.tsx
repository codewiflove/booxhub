'use client';

import type { LucideIcon } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { cn } from '@/lib/utils';

const TONES = {
  ocean: { bg: 'bg-ocean-50', text: 'text-ocean-700', stroke: '#1a93ad' },
  sand: { bg: 'bg-sand-100', text: 'text-sand-800', stroke: '#c69048' },
  coral: { bg: 'bg-coral-50', text: 'text-coral-700', stroke: '#f55a37' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', stroke: '#10b981' },
  muted: { bg: 'bg-surface', text: 'text-surface-muted', stroke: '#64748d' },
} as const;

export function SparkCard({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  deltaTone = 'green',
  spark,
  tone = 'ocean',
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  delta?: string;
  deltaTone?: 'green' | 'coral' | 'muted';
  spark?: { v: number }[];
  tone?: keyof typeof TONES;
}) {
  const t = TONES[tone];
  return (
    <div className="rounded-lg border border-surface-border bg-white p-4 shadow-stripe-card transition-shadow duration-200 hover:shadow-stripe-hover sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-surface-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ocean-950 tabular">{value}</p>
        </div>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', t.bg, t.text)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Area type="monotone" dataKey="v" stroke={t.stroke} strokeWidth={1.5} fill={t.stroke} fillOpacity={0.08} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        {delta && (
          <span className={cn(
            'rounded px-1.5 py-0.5 text-[11px] font-medium',
            deltaTone === 'green' && 'bg-emerald-50 text-emerald-700',
            deltaTone === 'coral' && 'bg-coral-50 text-coral-700',
            deltaTone === 'muted' && 'bg-surface text-surface-muted',
          )}>
            {delta}
          </span>
        )}
        {hint && <p className="text-[11px] text-surface-muted">{hint}</p>}
      </div>
    </div>
  );
}

export function ActionCard({
  code,
  badgeLabel,
  badgeClass,
  description,
  onClick,
}: {
  code: string;
  badgeLabel: string;
  badgeClass: string;
  description: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start justify-between gap-3 rounded-md border border-surface-border bg-white p-3.5 text-left transition-colors hover:border-ocean-400"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-medium text-ocean-950">{code}</span>
          <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', badgeClass)}>{badgeLabel}</span>
        </div>
        <p className="text-xs text-surface-muted">{description}</p>
      </div>
    </button>
  );
}
