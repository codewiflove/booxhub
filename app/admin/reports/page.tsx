'use client';

import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { BedDouble, Download, Loader2, Sparkles, TrendingUp, Users, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/shell/app-shell';
import { Panel, StatCard } from '@/components/shell/stat-card';
import { Button } from '@/components/ui/button';
import { RevenueMixChart, RevenueTrendChart, RoomPerformance, TopAgentsChart } from '@/components/reports/report-charts';
import { AgentTable } from '@/components/reports/agent-table';
import { AgentDetailSheet } from '@/components/reports/agent-detail-sheet';
import { cn } from '@/lib/utils';
import { formatDate, formatRM, STATUS_META } from '@/lib/format';
import { downloadAgentsCsv, fetchSalesReport, percent, rangeOptions, type RangeKey, type SalesReport } from '@/lib/reports';
import type { BookingStatus } from '@/lib/types';

const STATUS_ORDER: BookingStatus[] = ['FULLY_PAID', 'CONFIRMED_PARTIAL', 'PENDING_DEPOSIT', 'EXPIRED', 'CANCELLED'];

export default function ReportsPage() {
  const ranges = useMemo(() => rangeOptions(), []);
  const [rangeKey, setRangeKey] = useState<RangeKey>('season');
  const range = ranges.find((r) => r.key === rangeKey) ?? ranges[0];
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setFailed(false);
    fetchSalesReport(range.from, range.to)
      .then((r) => { if (!stale) setReport(r); })
      .catch((e) => { console.error('sales report failed', e); if (!stale) setFailed(true); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [range.from, range.to]);

  const days = differenceInCalendarDays(parseISO(range.to), parseISO(range.from)) + 1;
  const t = report?.totals;
  const agents = report?.agents ?? [];
  const selling = agents.filter((a) => a.revenue > 0);
  const top = selling[0];
  const top3Share = t ? percent(selling.slice(0, 3).reduce((s, a) => s + a.revenue, 0), t.revenue) : 0;
  const selectedAgent = agents.find((a) => a.agent_id === selected) ?? null;
  const statusTotal = report ? STATUS_ORDER.reduce((s, k) => s + (report.status[k] ?? 0), 0) : 0;

  return (
    <>
      <PageHeader title="Laporan Jualan" description="Prestasi jualan, penghunian dan ranking ejen mengikut tarikh ketibaan tetamu."
        actions={
          <Button variant="outline" disabled={!report || agents.length === 0}
            onClick={() => report && downloadAgentsCsv(agents, report.totals.revenue, range.label)}>
            <Download className="mr-2 h-4 w-4" />Muat Turun CSV
          </Button>
        } />

      <div className="-mx-1 mb-6 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        {ranges.map((r) => (
          <button key={r.key} type="button" onClick={() => setRangeKey(r.key)}
            className={cn('shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-all',
              r.key === rangeKey ? 'border-ocean-900 bg-ocean-900 text-white shadow-sm'
                : 'bg-card text-ocean-900 hover:border-ocean-300 hover:bg-ocean-50')}>
            {r.label}
          </button>
        ))}
        <span className="ml-auto hidden shrink-0 items-center gap-2 text-xs text-muted-foreground md:flex">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {formatDate(range.from)} – {formatDate(range.to)}
        </span>
      </div>

      {failed ? (
        <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Gagal memuatkan laporan. Sila cuba lagi.</p>
      ) : !report || !t ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      ) : (
        <div className={cn('space-y-6 transition-opacity duration-300', loading && 'opacity-60')}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={TrendingUp} label="Jumlah Jualan" value={formatRM(t.revenue)} hint={`${t.bookings} tempahan disahkan`} />
            <StatCard icon={Wallet} label="Kutipan Diterima" value={formatRM(t.collected)} tone="green"
              hint={t.outstanding > 0 ? `Baki tertunggak ${formatRM(t.outstanding)}` : 'Tiada baki tertunggak'} />
            <StatCard icon={BedDouble} label="Malam Bilik" value={t.room_nights.toLocaleString('ms-MY')} tone="sand"
              hint={`${t.guests.toLocaleString('ms-MY')} tetamu`} />
            <StatCard icon={Users} label="Ejen Aktif" value={`${t.active_agents}`} tone="coral"
              hint={`Purata ${formatRM(t.bookings ? t.revenue / t.bookings : 0)} / tempahan`} />
          </div>

          {top && (
            <div className="flex items-start gap-3 rounded-lg border border-sand-200 bg-gradient-to-r from-sand-50 to-white px-5 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-sand-800">
                <Sparkles className="h-4 w-4" />
              </span>
              <p className="text-sm leading-relaxed text-ocean-950">
                <span className="font-semibold">{top.company_name}</span> mendahului dengan {formatRM(top.revenue)}
                {' '}({percent(top.revenue, t.revenue).toFixed(1)}% jualan). 3 ejen teratas menyumbang
                {' '}<span className="font-semibold">{top3Share.toFixed(0)}%</span> daripada jumlah jualan
                {agents.length - selling.length > 0 && <>, manakala {agents.length - selling.length} ejen berdaftar belum mencatat jualan</>}.
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Trend Bulanan" className="lg:col-span-2"><RevenueTrendChart data={report.monthly} /></Panel>
            <Panel title="Komposisi Jualan"><RevenueMixChart totals={t} /></Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="10 Ejen Teratas">
              {selling.length ? <TopAgentsChart agents={agents} onSelect={setSelected} />
                : <p className="px-3 py-10 text-center text-sm text-muted-foreground">Tiada jualan dalam tempoh ini.</p>}
            </Panel>
            <Panel title="Prestasi Jenis Bilik">
              <div className="max-h-[400px] overflow-y-auto"><RoomPerformance rooms={report.rooms} days={days} /></div>
            </Panel>
          </div>

          <Panel title="Status Tempahan">
            <div className="px-3 pb-3 pt-1">
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                {STATUS_ORDER.map((k) => (report.status[k] ?? 0) > 0 && (
                  <div key={k} className={cn('h-full transition-all duration-700', STATUS_BAR[k])}
                    style={{ width: `${percent(report.status[k] ?? 0, statusTotal)}%` }} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {STATUS_ORDER.map((k) => (
                  <div key={k} className="rounded-xl border px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn('h-2 w-2 rounded-full', STATUS_BAR[k])} />{STATUS_META[k].label}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular text-ocean-950">{report.status[k] ?? 0}</p>
                  </div>
                ))}
              </div>
              {t.lost_bookings > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t.lost_bookings} tempahan tamat tempoh atau dibatalkan, bernilai {formatRM(t.lost_value)}.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Prestasi Ejen">
            <AgentTable agents={agents} totalRevenue={t.revenue} onSelect={setSelected} />
          </Panel>

          <p className="text-center text-xs text-muted-foreground">
            Jualan dikira mengikut tarikh daftar masuk bagi tempahan yang telah disahkan. Penghunian dikira daripada
            {' '}{report.total_units} unit bilik aktif.
          </p>
        </div>
      )}

      <AgentDetailSheet agent={selectedAgent} rank={selectedAgent ? agents.indexOf(selectedAgent) + 1 : 0}
        totalRevenue={t?.revenue ?? 0} months={report?.monthly ?? []} agentMonthly={report?.agent_monthly ?? []}
        onClose={() => setSelected(null)} />
    </>
  );
}

const STATUS_BAR: Record<BookingStatus, string> = {
  FULLY_PAID: 'bg-emerald-500',
  CONFIRMED_PARTIAL: 'bg-ocean-500',
  PENDING_DEPOSIT: 'bg-amber-400',
  EXPIRED: 'bg-slate-400',
  CANCELLED: 'bg-red-400',
};
