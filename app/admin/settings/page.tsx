'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shell/app-shell';
import { EmptyState } from '@/components/shell/stat-card';
import { RequireRole } from '@/components/auth/require-role';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/format';
import type { CompanyInfo } from '@/lib/company';

function toDraft(c: CompanyInfo) {
  return {
    name: c.name ?? '',
    legal_name: c.legal_name ?? '',
    address: c.address ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    bank_name: c.bank_name ?? '',
    bank_account: c.bank_account ?? '',
    bank_holder: c.bank_holder ?? '',
  };
}

function SettingsInner() {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [draft, setDraft] = useState<ReturnType<typeof toDraft> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_company_settings');
    if (error || !data) {
      setLoadFailed(true);
      return;
    }
    const info = data as CompanyInfo;
    setCompany(info);
    setDraft(toDraft(info));
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = (key: keyof NonNullable<typeof draft>) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setDraft((d) => (d ? { ...d, [key]: e.target.value } : d));
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { toast.error('Nama syarikat diperlukan.'); return; }
    setSaving(true);
    const { error } = await supabase.rpc('update_company_settings', {
      p_name: draft.name.trim(),
      p_legal_name: draft.legal_name.trim(),
      p_address: draft.address.trim(),
      p_phone: draft.phone.trim(),
      p_email: draft.email.trim(),
      p_bank_name: draft.bank_name.trim(),
      p_bank_account: draft.bank_account.trim(),
      p_bank_holder: draft.bank_holder.trim(),
    });
    setSaving(false);
    if (error) { toast.error(friendlyError(error, 'Gagal menyimpan tetapan.')); return; }
    toast.success('Tetapan syarikat dikemas kini. Proforma dan vucher akan guna maklumat baharu.');
    load();
  };

  if (loadFailed) {
    return (
      <>
        <PageHeader title="Tetapan Syarikat" description="Maklumat syarikat dan bank untuk proforma serta vucher." />
        <div className="rounded-lg border bg-card">
          <EmptyState icon={Settings} title="Tetapan tidak dapat dimuatkan">
            Sila muat semula halaman ini. Jika masalah berterusan, hubungi pentadbir sistem.
          </EmptyState>
        </div>
      </>
    );
  }

  if (!draft) {
    return (
      <>
        <PageHeader title="Tetapan Syarikat" description="Maklumat syarikat dan bank untuk proforma serta vucher." />
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-ocean-600" /></div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Tetapan Syarikat" description="Maklumat syarikat dan bank untuk proforma serta vucher."
        actions={<Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Simpan</Button>} />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-lg border bg-card p-6 shadow-stripe-card">
          <h2 className="font-semibold text-ocean-950">Maklumat syarikat</h2>
          <div className="space-y-1.5"><Label htmlFor="c-name">Nama dagangan</Label>
            <Input id="c-name" value={draft.name} onChange={set('name')} placeholder="Perhentian Bay Chalet" /></div>
          <div className="space-y-1.5"><Label htmlFor="c-legal">Nama berdaftar</Label>
            <Input id="c-legal" value={draft.legal_name} onChange={set('legal_name')} placeholder="Perhentian Bay Chalet Sdn Bhd" /></div>
          <div className="space-y-1.5"><Label htmlFor="c-address">Alamat</Label>
            <Textarea id="c-address" rows={3} value={draft.address} onChange={set('address')} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="c-phone">Telefon</Label>
              <Input id="c-phone" value={draft.phone} onChange={set('phone')} placeholder="+60 9-691 0000" /></div>
            <div className="space-y-1.5"><Label htmlFor="c-email">Emel</Label>
              <Input id="c-email" type="email" value={draft.email} onChange={set('email')} placeholder="booking@perhentianbay.my" /></div>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border bg-card p-6 shadow-stripe-card">
          <h2 className="font-semibold text-ocean-950">Akaun bank (untuk bayaran)</h2>
          <p className="text-sm text-muted-foreground">
            Maklumat ini akan tertera pada proforma invois dan notifikasi baki tempahan.
          </p>
          <div className="space-y-1.5"><Label htmlFor="c-bank">Nama bank</Label>
            <Input id="c-bank" value={draft.bank_name} onChange={set('bank_name')} placeholder="Maybank" /></div>
          <div className="space-y-1.5"><Label htmlFor="c-acct">Nombor akaun</Label>
            <Input id="c-acct" value={draft.bank_account} onChange={set('bank_account')} placeholder="5621 0000 0000" /></div>
          <div className="space-y-1.5"><Label htmlFor="c-holder">Nama pemegang akaun</Label>
            <Input id="c-holder" value={draft.bank_holder} onChange={set('bank_holder')} placeholder="Perhentian Bay Chalet Sdn Bhd" /></div>
        </section>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return <RequireRole roles={['super_admin']}><SettingsInner /></RequireRole>;
}