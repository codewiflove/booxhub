import Link from 'next/link';
import { Sailboat } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ light = false, href = '/' }: { light?: boolean; href?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-2">
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg transition-transform duration-200 group-hover:-rotate-6',
          light ? 'bg-white/15 text-white ring-1 ring-white/30' : 'bg-ocean-700 text-white'
        )}
      >
        <Sailboat className="h-4 w-4" />
      </span>
      <span className="leading-tight">
        <span className={cn('block text-sm font-semibold', light ? 'text-white' : 'text-ocean-950')}>
          Perhentian Bay
        </span>
        <span
          className={cn(
            'block text-[10px] font-semibold uppercase tracking-[0.2em]',
            light ? 'text-white/70' : 'text-ocean-600'
          )}
        >
          B2B Portal
        </span>
      </span>
    </Link>
  );
}
