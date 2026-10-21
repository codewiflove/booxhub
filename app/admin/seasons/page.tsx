'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, differenceInCalendarDays, eachMonthOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { ms } from 'date-fns/locale';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shell/app-shell';
import { RequireRole } from '@/components/auth/require-role';
import { SeasonBadge } from '@/components/booking/badges';
import { supabase } from '@/lib/supabase';
import { formatDate, friendlyError, malaysiaToday, SEASON_META, toISODate } from '@/lib/format';
import type { Season, SeasonRange } from '@/lib/types';
import { cn } from '@/lib/utils';

type Draft = Omit<SeasonRange, 'id'> & { id?: string };
const BLANK: Draft = { label: '', season_type: 'PEAK_HOLIDAY', start_date: '', end_date: '' };
const RANGE_SEASONS: Season[] = ['PEAK_HOLIDAY', 'LOW_MONSOON', 'WEEKEND', 'NORMAL_WEEKDAY'];

function SeasonDialog({ draft, onClose, onSaved }: { draft: Draft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(BLANK);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (draft) setD(draft); }, [draft]);

  const save = async () => {
    if (!d.label.trim() || !d.start_date || !d.end_date) { toast.error('Sila lengkapkan semua ruangan.'); return; }
    if (d.end_date < d.start_date) { toast.error('Tarikh tamat mesti selepas tarikh mula.'); return; }
    setSaving(true);
    const { id, ...fields } = d;
    const payload = { ...fields, label: fields.label.trim().slice(0, 80) };
    const { error } = id
      ? await supabase.from('season_ranges').update(payload).eq('id', id)
      : await supabase.from('season_ranges').insert(payload);
    setSaving(false);
    if (error) { toast.error(friendlyError(error, 'Gagal menyimpan musim.')); return; }
    toast.success('Musim disimpan. Tempahan baharu akan menggunakan kadar ini.');
    onSaved();
  };

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{d.id ? 'Kemas kini julat musim' : 'Julat musim baharu'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Label</Label><Input value={d.label} maxLength={80} placeholder="Contoh: Cuti Sekolah Jun" onChange={(e) => setD({ ...d, label: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Jenis musim</Label>
            <Select value={d.season_type} onValueChange={(v) => setD({ ...d, season_type: v as Season })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RANGE_SEASONS.map((s) => <SelectItem key={s} value={s}>{SEASON_META[s].label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Mula</Label><Input type="date" value={d.start_date} onChange={(e) => setD({ ...d, start_date: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Tamat</Label><Input type="date" value={d.end_date} min={d.start_date} onChange={(e) => setD({ ...d, end_date: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Jika julat bertindih, keutamaan: Puncak, kemudian Monsun, kemudian Hujung Minggu, kemudian Biasa.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function YearStrip({ ranges }: { ranges: SeasonRange[] }) {
  const start = startOfMonth(malaysiaToday());
  const months = eachMonthOfInterval({ start, end: addMonths(start, 11) });
  return (
    <div className="mb-8 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
      {months.map((m) => {
        const ms0 = toISODate(m); const me0 = toISODate(endOfMonth(m));
        const hits = ranges.filter((r) => r.start_date <= me0 && r.end_date >= ms0);
        return (
          <div key={ms0} className="rounded-xl border bg-card p-2.5">
            <p className="text-xs font-semibold capitalize text-ocean-950">{format(m, 'MMM yy', { locale: ms })}</p>
            <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
              {hits.map((h) => <span key={h.id} className={cn('flex-1', SEASON_META[h.season_type].dot)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SeasonsInner() {
  const [rows, setRows] = useState<SeasonRange[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('season_ranges').select('*').order('start_date');
    if (error) { toast.error(friendlyError(error, 'Gagal memuatkan musim.')); setRows([]); return; }
    setRows((data ?? []) as SeasonRange[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (r: SeasonRange) => {
    if (!window.confirm(`Padam julat "${r.label}"? Tempahan sedia ada tidak terjejas.`)) return;
    setDeleting(r.id);
    const { error } = await supabase.from('season_ranges').delete().eq('id', r.id);
    setDeleting(null);
    if (error) { toast.error(friendlyError(error, 'Gagal memadam musim.')); return; }
    toast.success('Julat musim dipadam.');
    load();
  };

  const todayISO = toISODate(malaysiaToday());
  const sorted = useMemo(() => rows ?? [], [rows]);

  return (
    <>
      <PageHeader title="Kalendar Musim" description="Tetapkan tarikh musim puncak dan monsun. Tanpa julat, Jumaat dan Sabtu dikira hujung minggu."
        actions={<Button onClick={() => setDraft(BLANK)}><Plus className="mr-2 h-4 w-4" /> Julat baharu</Button>} />
      {!rows ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      ) : (
        <>
          <YearStrip ranges={sorted} />
          {sorted.length === 0 ? (
            <p className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">Belum ada julat musim.</p>
          ) : (
            <ul className="divide-y rounded-lg border bg-card shadow-sm">
              {sorted.map((r) => {
                const past = r.end_date < todayISO;
                return (
                  <li key={r.id} className={cn('flex flex-wrap items-center gap-4 px-5 py-4', past && 'opacity-50')}>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ocean-950">{r.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(r.start_date)} - {formatDate(r.end_date)} · {differenceInCalendarDays(parseISO(r.end_date), parseISO(r.start_date)) + 1} hari{past && ' · Telah berlalu'}
                      </p>
                    </div>
                    <SeasonBadge season={r.season_type} />
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label="Edit" onClick={() => setDraft({ ...r })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Padam" disabled={deleting === r.id} onClick={() => remove(r)} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                        {deleting === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <SeasonDialog draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />
    </>
  );
}

export default function SeasonsPage() {
  return <RequireRole roles={['super_admin']}><SeasonsInner /></RequireRole>;
}
