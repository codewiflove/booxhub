import { cn } from '@/lib/utils';
import { STATUS_META, PAYMENT_STATUS_META, SEASON_META } from '@/lib/format';
import type { BookingStatus, PaymentStatus, Season } from '@/lib/types';

const base = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold';

export function StatusBadge({ status, short, className }: { status: BookingStatus; short?: boolean; className?: string }) {
  const meta = STATUS_META[status];
  return <span className={cn(base, meta.className, className)}>{short ? meta.short : meta.label}</span>;
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const meta = PAYMENT_STATUS_META[status];
  return <span className={cn(base, meta.className)}>{meta.label}</span>;
}

export function SeasonBadge({ season }: { season: Season }) {
  const meta = SEASON_META[season];
  return (
    <span className={cn(base, meta.className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.short}
    </span>
  );
}
