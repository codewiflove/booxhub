'use client';

import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { formatRM } from '@/lib/format';
import { compactRM, monthLabel, percent, type ReportAgent, type ReportMonth, type ReportRoom, type ReportTotals } from '@/lib/reports';

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-[160px] rounded-xl border bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1.5 font-semibold text-ocean-950">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-semibold tabular text-ocean-950">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

const METRICS = {
  revenue: { label: 'Jualan', color: '#137a9b', format: (v: number) => formatRM(v), axis: compactRM },
  bookings: { label: 'Tempahan', color: '#c69048', format: (v: number) => `${v} tempahan`, axis: (v: number) => String(v) },
  occupancy: { label: 'Penghunian', color: '#059669', format: (v: number) => `${v}%`, axis: (v: number) => `${v}%` },
} as const;
type Metric = keyof typeof METRICS;

export function RevenueTrendChart({ data }: { data: ReportMonth[] }) {
  const [metric, setMetric] = useState<Metric>('revenue');
  const m = METRICS[metric];
  const config = { [metric]: { label: m.label, color: m.color } } satisfies ChartConfig;
  const rows = data.map((d) => ({ ...d, label: monthLabel(d.month, data.length > 12 ? 'MMM yy' : 'MMM') }));

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1 px-3 pt-1">
        {(Object.keys(METRICS) as Metric[]).map((k) => (
          <button key={k} type="button" onClick={() => setMetric(k)}
            className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors',
              metric === k ? 'bg-ocean-900 text-white' : 'text-muted-foreground hover:bg-ocean-50 hover:text-ocean-800')}>
            {METRICS[k].label}
          </button>
        ))}
      </div>
      <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
        <AreaChart data={rows} margin={{ top: 12, right: 16, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`fill-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={m.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={m.color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="4 4" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
          <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => m.axis(v)} />
          <ChartTooltip cursor={{ stroke: m.color, strokeDasharray: '4 4' }} content={({ active, payload }) => {
            const p = payload?.[0]?.payload as (ReportMonth & { label: string }) | undefined;
            if (!active || !p) return null;
            return <TooltipBox title={monthLabel(p.month, 'MMMM yyyy')} rows={[
              { label: 'Jualan', value: formatRM(p.revenue), color: METRICS.revenue.color },
              { label: 'Tempahan', value: String(p.bookings), color: METRICS.bookings.color },
              { label: 'Malam bilik', value: String(p.room_nights) },
              { label: 'Penghunian', value: `${p.occupancy}%`, color: METRICS.occupancy.color },
            ]} />;
          }} />
          <Area key={metric} dataKey={metric} type="monotone" stroke={m.color} strokeWidth={2.5}
            fill={`url(#fill-${metric})`} dot={{ r: 3, fill: '#fff', strokeWidth: 2 }} activeDot={{ r: 5 }}
            animationDuration={700} />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

export function TopAgentsChart({ agents, onSelect }: { agents: ReportAgent[]; onSelect: (id: string) => void }) {
  const rows = agents.filter((a) => a.revenue > 0).slice(0, 10);
  const height = Math.max(160, rows.length * 34 + 16);
  return (
    <ChartContainer config={{ revenue: { label: 'Jualan', color: '#137a9b' } }} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 64, left: 0, bottom: 4 }} barCategoryGap={6}>
        <defs>
          <linearGradient id="agent-bar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1598b8" />
            <stop offset="100%" stopColor="#16627e" />
          </linearGradient>
        </defs>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="company_name" tickLine={false} axisLine={false} width={104}
          tick={{ fontSize: 11 }} tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}…` : v)} />
        <ChartTooltip cursor={{ fill: 'rgba(19,122,155,0.06)' }} content={({ active, payload }) => {
          const p = payload?.[0]?.payload as ReportAgent | undefined;
          if (!active || !p) return null;
          return <TooltipBox title={p.company_name} rows={[
            { label: 'Jualan', value: formatRM(p.revenue) },
            { label: 'Tempahan', value: String(p.bookings) },
            { label: 'Malam bilik', value: String(p.room_nights) },
          ]} />;
        }} />
        <Bar dataKey="revenue" radius={[0, 8, 8, 0]} className="cursor-pointer" animationDuration={700}
          onClick={(d: { agent_id?: string }) => d.agent_id && onSelect(d.agent_id)}>
          {rows.map((r, i) => <Cell key={r.agent_id} fill={i < 3 ? 'url(#agent-bar)' : '#72d2e6'} />)}
          <LabelList dataKey="revenue" position="right" formatter={(v: number) => compactRM(v)}
            className="fill-ocean-900 text-[11px] font-semibold" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const MIX = [
  { key: 'room_revenue', label: 'Bilik', color: '#137a9b' },
  { key: 'boat_revenue', label: 'Bot', color: '#31b5d3' },
  { key: 'van_revenue', label: 'Van', color: '#c69048' },
  { key: 'snorkel_revenue', label: 'Snorkeling', color: '#f55a37' },
] as const;

export function RevenueMixChart({ totals }: { totals: ReportTotals }) {
  const rows = MIX.map((m) => ({ ...m, value: Number(totals[m.key]) }));
  const sum = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="grid items-center gap-4 px-3 pb-3 sm:grid-cols-[200px_1fr] lg:grid-cols-1 xl:grid-cols-[200px_1fr]">
      <div className="relative mx-auto h-[200px] w-[200px]">
        <ChartContainer config={{}} className="aspect-square h-full w-full">
          <PieChart>
            <ChartTooltip content={({ active, payload }) => {
              const p = payload?.[0]?.payload as (typeof rows)[number] | undefined;
              if (!active || !p) return null;
              return <TooltipBox title={p.label} rows={[{ label: 'Jumlah', value: formatRM(p.value), color: p.color },
                { label: 'Bahagian', value: `${percent(p.value, sum).toFixed(1)}%` }]} />;
            }} />
            <Pie data={sum > 0 ? rows : [{ label: '-', value: 1, color: '#e2e8f0' }]} dataKey="value" nameKey="label"
              innerRadius={64} outerRadius={94} paddingAngle={sum > 0 ? 2 : 0} strokeWidth={0} animationDuration={700}>
              {(sum > 0 ? rows : [{ color: '#e2e8f0', label: '-' }]).map((r) => <Cell key={r.label} fill={r.color} />)}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Jumlah</span>
          <span className="font-display text-xl text-ocean-950 tabular">{compactRM(sum)}</span>
        </div>
      </div>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-ocean-950">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.color }} />{r.label}
              </span>
              <span className="tabular text-muted-foreground">{percent(r.value, sum).toFixed(1)}%</span>
            </div>
            <p className="pl-[18px] text-xs font-semibold tabular text-ocean-900">{formatRM(r.value)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RoomPerformance({ rooms, days }: { rooms: ReportRoom[]; days: number }) {
  const max = Math.max(1, ...rooms.map((r) => r.revenue));
  return (
    <ul className="divide-y">
      {rooms.map((r, i) => {
        const occ = r.units * days > 0 ? Math.min(100, percent(r.room_nights, r.units * days)) : 0;
        return (
          <li key={r.name} className="group px-3 py-3 transition-colors hover:bg-ocean-50/50">
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-ocean-950">
                <span className="mr-2 text-xs tabular text-muted-foreground">{i + 1}.</span>{r.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{r.units} unit</span>
              </p>
              <p className="shrink-0 text-sm font-semibold tabular text-ocean-950">{formatRM(r.revenue)}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ocean-50">
              <div className="h-full rounded-full bg-gradient-to-r from-ocean-400 to-ocean-700 transition-all duration-700"
                style={{ width: `${percent(r.revenue, max)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground tabular">
              {r.room_nights} malam bilik · penghunian {occ.toFixed(0)}%
            </p>
          </li>
        );
      })}
    </ul>
  );
}
