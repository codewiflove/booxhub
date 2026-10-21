import type { LucideIcon } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { cn } from '@/lib/utils';

const TONES = {
  ocean: 'bg-ocean-50 text-ocean-700',
  sand: 'bg-sand-100 text-sand-800',
  coral: 'bg-coral-50 text-coral-700',
  green: 'bg-emerald-50 text-emerald-700',
} as const;

const STROKE = {
  ocean: '#1a93ad',
  sand: '#c69048',
  coral: '#f55a37',
  green: '#10b981',
} as const;

export function StatCard({
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
  return (
    <div className="rounded-lg border border-surface-border bg-white p-4 shadow-stripe-card transition-shadow duration-200 hover:shadow-stripe-hover sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-surface-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ocean-950 tabular">{value}</p>
        </div>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-3 h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Area type="monotone" dataKey="v" stroke={STROKE[tone]} strokeWidth={1.5} fill={STROKE[tone]} fillOpacity={0.08} />
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

export function StatRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        '-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0',
        '[&>*]:w-[72%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Panel({ title, action, children, className }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-surface-border bg-white', className)}>
      <div className="flex min-h-[48px] items-center justify-between gap-3 border-b border-surface-border px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-ocean-950">{title}</h2>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-surface-muted">{children}</p>;
}

export function EmptyState({ icon: Icon, title, children, action }: {
  icon: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface text-surface-muted">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-ocean-950">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-surface-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuatkan">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-surface-border bg-white p-4">
          <div className="skeleton h-10 w-10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-2/5" />
            <div className="skeleton h-3 w-3/5" />
          </div>
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
