'use client';

import { useEffect, useState } from 'react';
import { Car, Loader2, Save, Ship, Waves } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shell/app-shell';
import { RequireRole } from '@/components/auth/require-role';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/format';
import type { AddonKey, AddonRate } from '@/lib/types';

const ICON: Record<AddonKey, typeof Ship> = { boat_return: Ship, van_one_way: Car, van_return: Car, snorkeling: Waves };

function AddonCard({ addon, onSaved }: { addon: AddonRate; onSaved: () => void }) {
  const [adult, setAdult] = useState(String(addon.price_adult));
  const [child, setChild] = useState(String(addon.price_child));
  const [saving, setSaving] = useState(false);
  const Icon = ICON[addon.key];
  const dirty = Number(adult) !== Number(addon.price_adult) || Number(child) !== Number(addon.price_child);

  const save = async () => {
    const a = Number(adult); const c = Number(child);
    if (!Number.isFinite(a) || !Number.isFinite(c) || a < 0 || c < 0) { toast.error('Harga tidak sah.'); return; }
    setSaving(true);
    const { error } = await supabase.from('addon_rates').update({ price_adult: a, price_child: c }).eq('key', addon.key);
    setSaving(false);
    if (error) { toast.error(friendlyError(error, 'Gagal menyimpan harga.')); return; }
    toast.success(`Harga ${addon.name} dikemas kini.`);
    onSaved();
  };

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ocean-50 text-ocean-700"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ocean-950">{addon.name}</p>
          <p className="text-sm text-muted-foreground">{addon.description}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Dewasa (RM)</Label><Input type="number" min={0} step="0.01" value={adult} onChange={(e) => setAdult(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Kanak-kanak (RM)</Label><Input type="number" min={0} step="0.01" value={child} onChange={(e) => setChild(e.target.value)} /></div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button size="sm" disabled={!dirty || saving} onClick={save}>
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Simpan
        </Button>
      </div>
    </div>
  );
}

function AddonsInner() {
  const [rows, setRows] = useState<AddonRate[] | null>(null);
  const load = async () => {
    const { data, error } = await supabase.from('addon_rates').select('*').order('sort_order');
    if (error) { toast.error(friendlyError(error, 'Gagal memuatkan harga.')); setRows([]); return; }
    setRows((data ?? []) as AddonRate[]);
  };
  useEffect(() => { load(); }, []);

  return (
    <>
      <PageHeader title="Harga Add-On" description="Harga seorang bagi pengangkutan dan aktiviti. Perubahan hanya terpakai pada tempahan baharu." />
      {!rows ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {rows.map((a) => <AddonCard key={`${a.key}-${a.price_adult}-${a.price_child}`} addon={a} onSaved={load} />)}
        </div>
      )}
    </>
  );
}

export default function AddonsPage() {
  return <RequireRole roles={['super_admin']}><AddonsInner /></RequireRole>;
}
