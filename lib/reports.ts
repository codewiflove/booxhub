import { addDays, endOfMonth, endOfYear, startOfMonth, startOfYear } from 'date-fns';
import { supabase } from './supabase';
import { formatDate, malaysiaToday, toISODate } from './format';
import type { BookingStatus } from './types';

export interface ReportTotals {
  revenue: number; collected: number; outstanding: number; bookings: number; room_nights: number;
  guests: number; active_agents: number; room_revenue: number; boat_revenue: number; van_revenue: number;
  snorkel_revenue: number; lost_bookings: number; lost_value: number;
}

export interface ReportMonth {
  month: string; revenue: number; collected: number; bookings: number; room_nights: number; occupancy: number;
}

export interface ReportAgent {
  agent_id: string; company_name: string; full_name: string; status: string;
  revenue: number; collected: number; bookings: number; room_nights: number; guests: number;
  last_check_in: string | null; expired: number; cancelled: number;
}

export interface ReportAgentMonth { agent_id: string; month: string; revenue: number; bookings: number }
export interface ReportRoom { name: string; units: number; room_nights: number; revenue: number }

export interface SalesReport {
  total_units: number;
  totals: ReportTotals;
  monthly: ReportMonth[];
  agents: ReportAgent[];
  agent_monthly: ReportAgentMonth[];
  rooms: ReportRoom[];
  status: Partial<Record<BookingStatus, number>>;
}

export type RangeKey = 'season' | 'year' | 'last90' | 'month' | 'next90';

export function rangeOptions() {
  const today = malaysiaToday();
  const y = today.getFullYear();
  const opts: { key: RangeKey; label: string; from: Date; to: Date }[] = [
    { key: 'season', label: `Mei–Sep ${y}`, from: new Date(y, 4, 1), to: new Date(y, 8, 30) },
    { key: 'year', label: `Tahun ${y}`, from: startOfYear(today), to: endOfYear(today) },
    { key: 'last90', label: '90 hari lepas', from: addDays(today, -89), to: today },
    { key: 'month', label: 'Bulan ini', from: startOfMonth(today), to: endOfMonth(today) },
    { key: 'next90', label: '90 hari akan datang', from: today, to: addDays(today, 89) },
  ];
  return opts.map((o) => ({ ...o, from: toISODate(o.from), to: toISODate(o.to) }));
}

function isReport(value: unknown): value is SalesReport {
  const r = value as SalesReport | null;
  return !!r && typeof r === 'object' && !!r.totals && Array.isArray(r.monthly) && Array.isArray(r.agents)
    && Array.isArray(r.agent_monthly) && Array.isArray(r.rooms);
}

export async function fetchSalesReport(from: string, to: string): Promise<SalesReport> {
  const { data, error } = await supabase.rpc('sales_report', { p_from: from, p_to: to });
  if (error) throw error;
  if (!isReport(data)) throw new Error('Unexpected report shape');
  return data;
}

export function monthLabel(month: string, pattern = 'MMM') {
  return formatDate(`${month}-01`, pattern);
}

export function compactRM(value: number) {
  if (Math.abs(value) >= 1000) return `RM${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `RM${Math.round(value)}`;
}

export function percent(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function csvCell(value: string | number) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadAgentsCsv(agents: ReportAgent[], totalRevenue: number, label: string) {
  const header = ['Kedudukan', 'Ejen', 'Wakil', 'Tempahan', 'Malam Bilik', 'Tetamu', 'Jualan (RM)', 'Kutipan (RM)', 'Baki (RM)', 'Bahagian (%)', 'Purata (RM)', 'Tamat Tempoh', 'Batal'];
  const rows = agents.map((a, i) => [
    i + 1, a.company_name, a.full_name, a.bookings, a.room_nights, a.guests,
    a.revenue.toFixed(2), a.collected.toFixed(2), (a.revenue - a.collected).toFixed(2),
    percent(a.revenue, totalRevenue).toFixed(1), (a.bookings ? a.revenue / a.bookings : 0).toFixed(2),
    a.expired, a.cancelled,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `prestasi-ejen-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
