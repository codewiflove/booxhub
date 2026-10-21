'use client';

import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    h: Math.floor(total / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function HoldCountdown({
  expiresAt,
  size = 'sm',
  onExpire,
}: {
  expiresAt: string;
  size?: 'sm' | 'lg';
  onExpire?: () => void;
}) {
  const now = useNow();
  const remaining = new Date(expiresAt).getTime() - now;
  const expired = remaining <= 0;
  const urgent = remaining < 60 * 60 * 1000;
  const { h, m, s } = parts(remaining);

  useEffect(() => {
    if (expired && onExpire) onExpire();
  }, [expired, onExpire]);

  if (size === 'lg') {
    return (
      <div className="flex items-end gap-3 tabular">
        {[
          [h, 'jam'],
          [m, 'minit'],
          [s, 'saat'],
        ].map(([v, l]) => (
          <div key={l as string} className="text-center">
            <div
              className={cn(
                'min-w-[64px] rounded-xl px-3 py-2 font-display text-3xl',
                expired ? 'bg-slate-100 text-slate-400' : urgent ? 'bg-coral-50 text-coral-700' : 'bg-white text-ocean-900 shadow-sm'
              )}
            >
              {String(v).padStart(2, '0')}
            </div>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-semibold tabular',
        expired ? 'text-slate-400' : urgent ? 'text-coral-600' : 'text-amber-700'
      )}
    >
      <Timer className="h-3.5 w-3.5" />
      {expired ? 'Tamat' : `${h}j ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`}
    </span>
  );
}
