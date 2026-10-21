'use client';

import { useEffect, useMemo, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, format, isWeekend, parseISO, startOfMonth } from 'date-fns';
import { ms } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell/app-shell';
import { supabase } from '@/lib/supabase';
import { formatRM, friendlyError, malaysiaToday, SEASON_META, toISODate } from '@/lib/format';
import type { AvailabilityRow, RoomType, Season } from '@/lib/types';
import { cn } from '@/lib/utils';

function cellTone(available: number, total: number) {
  if (available <= 0) return 'bg-slate-100 text-slate-400';
  if (available / total <= 0.25) return 'bg-coral-50 text-coral-700';
  if (available / total <= 0.5) return 'bg-sand-100 text-sand-800';
  return 'bg-emerald-50 text-emerald-700';
}

export default function CalendarPage() {
  const thisMonth = startOfMonth(malaysiaToday());
  const [month, setMonth] = useState(thisMonth);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [rows, setRows] = useState<AvailabilityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('room_types').select('*').eq('is_active', true).order('sort_order');
      if (error) { setError(friendlyError(error, 'Gagal memuatkan jenis bilik.')); return; }
      setRooms((data ?? []) as RoomType[]);
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    (async () => {
      const { data, error } = await supabase.rpc('get_availability', {
        p_start: toISODate(month), p_end: toISODate(endOfMonth(month)),
      });
      if (cancelled) return;
      if (error) { setError(friendlyError(error, 'Gagal memuatkan kekosongan.')); return; }
      setError(null);
      setRows((data ?? []) as AvailabilityRow[]);
    })();
    return () => { cancelled = true; };
  }, [month]);

  const days = useMemo(() => eachDayOfInterval({ start: month, end: endOfMonth(month) }), [month]);
  const byKey = useMemo(() => {
    const m = new Map<string, AvailabilityRow>();
    (rows ?? []).forEach((r) => m.set(`${r.room_type_id}|${r.day}`, r));
    return m;
  }, [rows]);
  const seasonByDay = useMemo(() => {
    const m = new Map<string, Season>();
    (rows ?? []).forEach((r) => m.set(r.day, r.season));
    return m;
  }, [rows]);
  const todayISO = toISODate(malaysiaToday());

  return (
    <>
      <PageHeader title="Kalendar Bilik" description="Kekosongan masa nyata dan harga bersih ejen bagi setiap malam." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Bulan sebelum" disabled={month <= thisMonth} onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="min-w-[160px] text-center font-display text-xl capitalize text-ocean-950">{format(month, 'MMMM yyyy', { locale: ms })}</p>
          <Button variant="outline" size="icon" aria-label="Bulan seterusnya" disabled={month >= addMonths(thisMonth, 11)} onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {(Object.keys(SEASON_META) as Season[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5"><span className={cn('h-2.5 w-2.5 rounded-full', SEASON_META[s].dot)} />{SEASON_META[s].label}</span>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">{error}</p>
      ) : !rows ? (
        <div className="flex justify-center rounded-2xl border bg-card py-20"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      ) : (
        <div className="animate-fade-up overflow-x-auto rounded-2xl border bg-card shadow-sm">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[180px] border-b bg-card px-4 py-3 text-left font-semibold text-ocean-950">Jenis bilik</th>
                {days.map((d) => {
                  const iso = toISODate(d);
                  const season = seasonByDay.get(iso);
                  return (
                    <th key={iso} className={cn('min-w-[64px] border-b px-1 py-2 text-center font-medium', isWeekend(d) && 'bg-muted/40', iso === todayISO && 'text-ocean-700')}>
                      <span className="block text-[10px] uppercase text-muted-foreground">{format(d, 'EEE', { locale: ms })}</span>
                      <span className="block text-base">{format(d, 'd')}</span>
                      {season && <span className={cn('mx-auto mt-1 block h-1 w-6 rounded-full', SEASON_META[season].dot)} />}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td className="sticky left-0 z-10 border-b bg-card px-4 py-3">
                    <p className="font-semibold text-ocean-950">{room.name}</p>
                    <p className="text-xs text-muted-foreground">{room.total_units} unit</p>
                  </td>
                  {days.map((d) => {
                    const iso = toISODate(d);
                    const r = byKey.get(`${room.id}|${iso}`);
                    const past = iso < todayISO;
                    return (
                      <td key={iso} className="border-b p-1">
                        {r && (
                          <div title={`${r.available} / ${r.total_units} kosong`}
                            className={cn('rounded-lg px-1 py-1.5 text-center transition-transform hover:scale-105', past ? 'opacity-40' : '', cellTone(r.available, r.total_units))}>
                            <p className="font-semibold tabular">{r.available}</p>
                            <p className="text-[10px] tabular opacity-80">{formatRM(r.rate).replace('RM', '').trim()}</p>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Nombor besar = unit kosong. Nombor kecil = harga bersih seunit semalam (RM).</p>
    </>
  );
}
