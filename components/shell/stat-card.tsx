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
    <div className="animate-fade-up rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl text-ocean-950 tabular">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({ title, action, children, className }: {
  title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border bg-card shadow-sm', className)}>
      <div className="flex items-center justify-between border-b px-5 py-4">
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
