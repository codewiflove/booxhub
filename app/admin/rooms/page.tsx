'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shell/app-shell';
import { RequireRole } from '@/components/auth/require-role';
import { supabase } from '@/lib/supabase';
import { formatRM, friendlyError, SEASON_META } from '@/lib/format';
import type { RoomType, Season } from '@/lib/types';
import { cn } from '@/lib/utils';

const RATE_FIELDS: { key: 'rate_low_monsoon' | 'rate_normal_weekday' | 'rate_weekend' | 'rate_peak_holiday'; season: Season }[] = [
  { key: 'rate_low_monsoon', season: 'LOW_MONSOON' },
  { key: 'rate_normal_weekday', season: 'NORMAL_WEEKDAY' },
  { key: 'rate_weekend', season: 'WEEKEND' },
  { key: 'rate_peak_holiday', season: 'PEAK_HOLIDAY' },
];

type Draft = Omit<RoomType, 'id' | 'slug'> & { id?: string };

const BLANK: Draft = {
  name: '', description: '', image_url: '', total_units: 1, max_adults: 2, max_children: 1,
  rate_low_monsoon: 0, rate_normal_weekday: 0, rate_weekend: 0, rate_peak_holiday: 0, sort_order: 10, is_active: true,
};

function slugify(s: string) {
  return `${s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)}-${Math.random().toString(36).slice(2, 6)}`;
}

function RoomDialog({ draft, onClose, onSaved }: { draft: Draft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(BLANK);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (draft) setD(draft); }, [draft]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));
  const num = (v: string) => Math.max(0, Number(v) || 0);

  const save = async () => {
    if (!d.name.trim()) { toast.error('Nama bilik diperlukan.'); return; }
    if (d.total_units < 1 || d.max_adults < 1) { toast.error('Bilangan unit dan dewasa mesti sekurang-kurangnya 1.'); return; }
    if (RATE_FIELDS.some((f) => d[f.key] <= 0)) { toast.error('Semua kadar musim mesti lebih daripada RM0.'); return; }
    setSaving(true);
    const { id, ...fields } = d;
    const payload = { ...fields, name: fields.name.trim(), description: fields.description.trim(), image_url: fields.image_url.trim() };
    const { error } = id
      ? await supabase.from('room_types').update(payload).eq('id', id)
      : await supabase.from('room_types').insert({ ...payload, slug: slugify(payload.name) });
    setSaving(false);
    if (error) { toast.error(friendlyError(error, 'Gagal menyimpan bilik.')); return; }
    toast.success('Bilik disimpan.');
    onSaved();
  };

  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{d.id ? 'Kemas kini bilik' : 'Jenis bilik baharu'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label>Nama</Label><Input value={d.name} maxLength={80} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Penerangan</Label><Textarea rows={2} value={d.description} maxLength={400} onChange={(e) => set('description', e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>URL gambar</Label><Input value={d.image_url} placeholder="https://" onChange={(e) => set('image_url', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Jumlah unit</Label><Input type="number" min={1} value={d.total_units} onChange={(e) => set('total_units', num(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>Susunan paparan</Label><Input type="number" value={d.sort_order} onChange={(e) => set('sort_order', Number(e.target.value) || 0)} /></div>
          <div className="space-y-1.5"><Label>Maks dewasa / unit</Label><Input type="number" min={1} value={d.max_adults} onChange={(e) => set('max_adults', num(e.target.value))} /></div>
          <div className="space-y-1.5"><Label>Maks kanak-kanak / unit</Label><Input type="number" min={0} value={d.max_children} onChange={(e) => set('max_children', num(e.target.value))} /></div>
        </div>
        <div className="mt-2 rounded-xl border bg-muted/30 p-4">
          <p className="mb-3 text-sm font-semibold text-ocean-950">Kadar bersih ejen seunit semalam (RM)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {RATE_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', SEASON_META[f.season].dot)} />{SEASON_META[f.season].label}</Label>
                <Input type="number" min={0} step="0.01" value={d[f.key]} onChange={(e) => set(f.key, num(e.target.value))} />
              </div>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between rounded-xl border p-4">
          <span><span className="block text-sm font-semibold">Aktif untuk tempahan</span><span className="text-xs text-muted-foreground">Bilik tidak aktif disembunyikan daripada ejen.</span></span>
          <Switch checked={d.is_active} onCheckedChange={(v) => set('is_active', v)} />
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoomsInner() {
  const [rows, setRows] = useState<RoomType[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('room_types').select('*').order('sort_order');
    if (error) { toast.error(friendlyError(error, 'Gagal memuatkan bilik.')); setRows([]); return; }
    setRows((data ?? []) as RoomType[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader title="Bilik & Harga" description="Inventori unit dan kadar bersih ejen bagi setiap musim."
        actions={<Button onClick={() => setDraft(BLANK)}><Plus className="mr-2 h-4 w-4" /> Bilik baharu</Button>} />
      {!rows ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {rows.map((r) => (
            <article key={r.id} className={cn('group animate-fade-up overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md', !r.is_active && 'opacity-60')}>
              <div className="relative h-40 overflow-hidden bg-ocean-100">
                {r.image_url && <img src={r.image_url} alt={r.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />}
                {!r.is_active && <span className="absolute left-3 top-3 rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white">Tidak aktif</span>}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ocean-950">{r.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground"><Users className="h-3.5 w-3.5" /> {r.max_adults} dewasa + {r.max_children} kanak-kanak · {r.total_units} unit</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setDraft({ ...r })}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2">
                  {RATE_FIELDS.map((f) => (
                    <div key={f.key} className="rounded-lg bg-muted/40 px-3 py-2">
                      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn('h-2 w-2 rounded-full', SEASON_META[f.season].dot)} />{SEASON_META[f.season].label}</dt>
                      <dd className="font-semibold tabular text-ocean-950">{formatRM(r[f.key])}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>
          ))}
        </div>
      )}
      <RoomDialog draft={draft} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); load(); }} />
    </>
  );
}

export default function RoomsPage() {
  return <RequireRole roles={['super_admin']}><RoomsInner /></RequireRole>;
}
