'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDate, formatRM } from '@/lib/format';
import { percent, type ReportAgent } from '@/lib/reports';

type SortKey = 'revenue' | 'bookings' | 'room_nights' | 'avg' | 'outstanding';

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'bookings', label: 'Tempahan' },
  { key: 'room_nights', label: 'Malam Bilik', className: 'hidden md:table-cell' },
  { key: 'avg', label: 'Purata', className: 'hidden lg:table-cell' },
  { key: 'outstanding', label: 'Baki', className: 'hidden xl:table-cell' },
  { key: 'revenue', label: 'Jualan' },
];

function value(a: ReportAgent, key: SortKey) {
  if (key === 'avg') return a.bookings ? a.revenue / a.bookings : 0;
  if (key === 'outstanding') return a.revenue - a.collected;
  return a[key];
}

const MEDAL = ['bg-sand-400 text-white', 'bg-slate-300 text-slate-800', 'bg-sand-700 text-white'];

export function AgentTable({ agents, totalRevenue, onSelect }: {
  agents: ReportAgent[]; totalRevenue: number; onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'revenue', desc: true });

  const rank = useMemo(() => new Map(agents.map((a, i) => [a.agent_id, i + 1])), [agents]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return agents
      .filter((a) => !q || a.company_name.toLowerCase().includes(q) || a.full_name.toLowerCase().includes(q))
      .sort((a, b) => (value(a, sort.key) - value(b, sort.key)) * (sort.desc ? -1 : 1));
  }, [agents, query, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));

  return (
    <div>
      <div className="flex flex-col gap-3 px-3 pb-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari ejen..." className="pl-9" />
        </div>
        <p className="text-xs text-muted-foreground">{rows.length} ejen · klik baris untuk butiran</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y bg-ocean-50/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-12 px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Ejen</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={cn('px-3 py-2.5 text-right font-medium', c.className)}>
                  <button type="button" onClick={() => toggle(c.key)}
                    className={cn('inline-flex items-center gap-1 uppercase transition-colors hover:text-ocean-800',
                      sort.key === c.key && 'text-ocean-800')}>
                    {c.label}
                    {sort.key === c.key && (sort.desc ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                  </button>
                </th>
              ))}
              <th className="hidden w-40 px-3 py-2.5 font-medium sm:table-cell">Bahagian</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((a) => {
              const r = rank.get(a.agent_id) ?? 0;
              const share = percent(a.revenue, totalRevenue);
              return (
                <tr key={a.agent_id} onClick={() => onSelect(a.agent_id)}
                  className="group cursor-pointer transition-colors hover:bg-ocean-50/60">
                  <td className="px-3 py-3">
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular',
                      a.revenue > 0 && r <= 3 ? MEDAL[r - 1] : 'bg-muted text-muted-foreground')}>{r}</span>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-ocean-950">{a.company_name || a.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.last_check_in ? `Ketibaan terakhir ${formatDate(a.last_check_in, 'd MMM')}` : 'Tiada jualan dalam tempoh ini'}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right tabular">{a.bookings}</td>
                  <td className="hidden px-3 py-3 text-right tabular md:table-cell">{a.room_nights}</td>
                  <td className="hidden px-3 py-3 text-right tabular lg:table-cell">{formatRM(a.bookings ? a.revenue / a.bookings : 0)}</td>
                  <td className={cn('hidden px-3 py-3 text-right tabular xl:table-cell',
                    a.revenue - a.collected > 0 ? 'text-coral-700' : 'text-muted-foreground')}>
                    {formatRM(a.revenue - a.collected)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular text-ocean-950">{formatRM(a.revenue)}</td>
                  <td className="hidden px-3 py-3 sm:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ocean-50">
                        <div className="h-full rounded-full bg-ocean-500 transition-all duration-700" style={{ width: `${Math.min(100, share)}%` }} />
                      </div>
                      <span className="w-11 text-right text-xs tabular text-muted-foreground">{share.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="pr-3">
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">Tiada ejen sepadan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
