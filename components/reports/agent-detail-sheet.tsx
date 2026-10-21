'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { BedDouble, CalendarCheck, Hourglass, Users, Wallet, XCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { formatDate, formatRM } from '@/lib/format';
import { compactRM, monthLabel, percent, type ReportAgent, type ReportAgentMonth, type ReportMonth } from '@/lib/reports';

function Metric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</p>
      <p className="mt-1 font-semibold tabular text-ocean-950">{value}</p>
    </div>
  );
}

export function AgentDetailSheet({ agent, rank, totalRevenue, months, agentMonthly, onClose }: {
  agent: ReportAgent | null; rank: number; totalRevenue: number; months: ReportMonth[];
  agentMonthly: ReportAgentMonth[]; onClose: () => void;
}) {
  const series = agent ? months.map((m) => {
    const hit = agentMonthly.find((x) => x.agent_id === agent.agent_id && x.month === m.month);
    return { month: m.month, label: monthLabel(m.month), revenue: hit?.revenue ?? 0, bookings: hit?.bookings ?? 0 };
  }) : [];
  const best = series.reduce<(typeof series)[number] | null>((b, s) => (!b || s.revenue > b.revenue ? s : b), null);

  return (
    <Sheet open={!!agent} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {agent && (
          <>
            <SheetHeader className="text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-ocean-600">Kedudukan #{rank}</p>
              <SheetTitle className="font-sans text-2xl text-ocean-950">{agent.company_name || agent.full_name}</SheetTitle>
              <SheetDescription>{agent.full_name}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 rounded-lg bg-gradient-to-br from-ocean-800 to-ocean-950 p-5 text-white">
              <p className="text-xs uppercase tracking-wider text-ocean-200">Jumlah jualan</p>
              <p className="mt-1 font-sans text-3xl tabular">{formatRM(agent.revenue)}</p>
              <p className="mt-2 text-sm text-ocean-100">
                {percent(agent.revenue, totalRevenue).toFixed(1)}% daripada jumlah jualan ejen
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric icon={CalendarCheck} label="Tempahan disahkan" value={String(agent.bookings)} />
              <Metric icon={BedDouble} label="Malam bilik" value={String(agent.room_nights)} />
              <Metric icon={Users} label="Tetamu" value={String(agent.guests)} />
              <Metric icon={Wallet} label="Purata / tempahan" value={formatRM(agent.bookings ? agent.revenue / agent.bookings : 0)} />
              <Metric icon={Hourglass} label="Hold tamat tempoh" value={String(agent.expired)} />
              <Metric icon={XCircle} label="Dibatalkan" value={String(agent.cancelled)} />
            </div>

            {agent.revenue - agent.collected > 0 && (
              <p className="mt-4 rounded-xl border border-coral-200 bg-coral-50 px-4 py-3 text-sm text-coral-800">
                Baki belum dibayar: <span className="font-semibold tabular">{formatRM(agent.revenue - agent.collected)}</span>
              </p>
            )}

            <div className="mt-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-semibold text-ocean-950">Jualan bulanan</h3>
                {best && best.revenue > 0 && (
                  <p className="text-xs text-muted-foreground">Terbaik: {monthLabel(best.month, 'MMMM')}</p>
                )}
              </div>
              <ChartContainer config={{ revenue: { label: 'Jualan', color: '#137a9b' } }} className="aspect-auto h-[220px] w-full">
                <BarChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="4 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => compactRM(v)} />
                  <ChartTooltip cursor={{ fill: 'rgba(19,122,155,0.06)' }} content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as (typeof series)[number] | undefined;
                    if (!active || !p) return null;
                    return (
                      <div className="rounded-xl border bg-white px-3 py-2 text-xs shadow-lg">
                        <p className="font-semibold text-ocean-950">{monthLabel(p.month, 'MMMM yyyy')}</p>
                        <p className="mt-1 tabular">{formatRM(p.revenue)} · {p.bookings} tempahan</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} animationDuration={600} />
                </BarChart>
              </ChartContainer>
            </div>

            {agent.last_check_in && (
              <p className="mt-4 text-xs text-muted-foreground">Ketibaan terakhir dalam tempoh: {formatDate(agent.last_check_in)}</p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
