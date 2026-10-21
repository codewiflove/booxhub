import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONES = {
  ocean: 'bg-ocean-50 text-ocean-700',
  sand: 'bg-sand-100 text-sand-800',
  coral: 'bg-coral-50 text-coral-700',
  green: 'bg-emerald-50 text-emerald-700',
} as const;

export function StatCard({ icon: Icon, label, value, hint, tone = 'ocean' }: {
  icon: LucideIcon; label: string; value: React.ReactNode; hint?: string; tone?: keyof typeof TONES;
}) {
  return (
    <div className="animate-fade-up rounded-2xl border border-ocean-950/[0.06] bg-card p-4 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl text-ocean-950 tabular sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Horizontal swipe row on phones, regular grid from sm up. */
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
    <section className={cn('rounded-2xl border border-ocean-950/[0.06] bg-card shadow-soft', className)}>
      <div className="flex min-h-[56px] items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <h2 className="font-semibold text-ocean-950">{title}</h2>
        {action}
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

export function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-3 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

export function EmptyState({ icon: Icon, title, children, action }: {
  icon: LucideIcon; title: string; children?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-ocean-50 to-sand-100 text-ocean-600 ring-8 ring-ocean-50/50">
        <Icon className="h-7 w-7" />
      </span>
      <p className="mt-5 font-semibold text-ocean-950">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuatkan">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <div className="skeleton h-12 w-12 shrink-0" />
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
