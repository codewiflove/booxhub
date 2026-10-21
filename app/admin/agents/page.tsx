'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, Check, Loader2, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/shell/app-shell';
import { DemoAccessDialog } from '@/components/admin/demo-access-dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/lib/supabase';
import { formatDate, friendlyError } from '@/lib/format';
import type { AccountStatus, Profile, Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS: Record<AccountStatus, { label: string; className: string }> = {
  pending: { label: 'Menunggu', className: 'bg-sand-100 text-sand-800' },
  approved: { label: 'Aktif', className: 'bg-emerald-50 text-emerald-700' },
  suspended: { label: 'Digantung', className: 'bg-slate-100 text-slate-600' },
};
const ROLE_LABEL: Record<Role, string> = { agent: 'Ejen', ops_admin: 'Admin Operasi', super_admin: 'Super Admin' };
const TABS: { key: 'all' | AccountStatus; label: string }[] = [
  { key: 'pending', label: 'Menunggu kelulusan' }, { key: 'approved', label: 'Aktif' }, { key: 'suspended', label: 'Digantung' }, { key: 'all', label: 'Semua' },
];

export default function AgentsPage() {
  const { profile: me } = useAuth();
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [tab, setTab] = useState<'all' | AccountStatus>('pending');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { toast.error(friendlyError(error, 'Gagal memuatkan senarai pengguna.')); setRows([]); return; }
    setRows((data ?? []) as Profile[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (u: Profile, patch: { p_status?: AccountStatus; p_role?: Role; p_hold_blocked?: boolean }, msg: string) => {
    setBusy(u.id);
    const { error } = await supabase.rpc('admin_update_agent', {
      p_user: u.id, p_status: patch.p_status ?? u.status, p_role: patch.p_role ?? u.role, p_hold_blocked: patch.p_hold_blocked ?? u.hold_blocked,
    });
    setBusy(null);
    if (error) { toast.error(friendlyError(error, 'Kemas kini gagal.')); return; }
    toast.success(msg);
    load();
  };

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, approved: 0, suspended: 0 };
    (rows ?? []).forEach((r) => { c.all++; c[r.status]++; });
    return c;
  }, [rows]);

  const filtered = (rows ?? []).filter((r) => (tab === 'all' || r.status === tab)
    && `${r.full_name} ${r.company_name} ${r.email} ${r.license_no}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Pengurusan Ejen" description="Luluskan pendaftaran agensi, urus peranan dan sekatan hold."
        actions={me?.role === 'super_admin' && !me.is_demo ? <DemoAccessDialog /> : undefined} />
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('rounded-full border px-4 py-1.5 text-sm font-medium transition-colors', tab === t.key ? 'border-ocean-700 bg-ocean-700 text-white' : 'bg-card hover:bg-muted')}>
              {t.label} <span className="ml-1 opacity-70">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, syarikat, e-mel" className="pl-9" />
        </div>
      </div>

      {!rows ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">Tiada pengguna dalam kategori ini.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((u) => {
            const self = u.id === me?.id;
            return (
              <li key={u.id} className="rounded-lg border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ocean-950">{u.company_name || u.full_name}</p>
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS[u.status].className)}>{STATUS[u.status].label}</span>
                      {u.hold_blocked && <span className="flex items-center gap-1 rounded-full bg-coral-50 px-2.5 py-0.5 text-xs font-medium text-coral-700"><ShieldAlert className="h-3 w-3" /> Hold disekat</span>}
                      {self && <span className="text-xs text-muted-foreground">(anda)</span>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{u.full_name} · {u.email} · {u.phone}</p>
                    <p className="text-xs text-muted-foreground">
                      Lesen: {u.license_no || '-'} · Daftar {formatDate(u.created_at.slice(0, 10))} · {u.consecutive_expired} tamat tempoh berturut
                    </p>
                  </div>
                  {!self && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={u.role} disabled={busy === u.id} onValueChange={(v) => act(u, { p_role: v as Role }, 'Peranan dikemas kini.')}>
                        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                      </Select>
                      {u.role === 'agent' && (
                        <Button size="sm" variant="outline" disabled={busy === u.id}
                          onClick={() => act(u, { p_hold_blocked: !u.hold_blocked }, u.hold_blocked ? 'Sekatan hold ditarik balik.' : 'Hold ejen disekat.')}>
                          {u.hold_blocked ? <><ShieldCheck className="mr-1.5 h-4 w-4" /> Buka sekatan</> : <><ShieldAlert className="mr-1.5 h-4 w-4" /> Sekat hold</>}
                        </Button>
                      )}
                      {u.status !== 'approved' && (
                        <Button size="sm" disabled={busy === u.id} className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => act(u, { p_status: 'approved' }, 'Akaun diluluskan.')}>
                          <Check className="mr-1.5 h-4 w-4" /> Luluskan
                        </Button>
                      )}
                      {u.status === 'approved' && (
                        <Button size="sm" variant="outline" disabled={busy === u.id} className="text-red-700 hover:bg-red-50 hover:text-red-700"
                          onClick={() => act(u, { p_status: 'suspended' }, 'Akaun digantung.')}>
                          <Ban className="mr-1.5 h-4 w-4" /> Gantung
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
