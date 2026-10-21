'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, ShieldCheck, Sparkles, Briefcase } from 'lucide-react';
import { demoSignIn, fetchDemoEnabled, type DemoRole } from '@/lib/demo';
import { cn } from '@/lib/utils';

const OPTIONS: { role: DemoRole; title: string; desc: string; icon: typeof ShieldCheck; tone: string }[] = [
  {
    role: 'admin',
    title: 'Masuk sebagai Admin',
    desc: 'Lihat 33 ejen & jualan Mei–Sep, sahkan resit, lulus ejen baharu dan semak manifest ketibaan.',
    icon: ShieldCheck,
    tone: 'bg-ocean-900 text-white',
  },
  {
    role: 'agent',
    title: 'Masuk sebagai Ejen',
    desc: 'Masuk sebagai BLUE STAR: buat tempahan, muat naik resit, cetak proforma & baucar tetamu.',
    icon: Briefcase,
    tone: 'bg-sand-200 text-ocean-950',
  },
];

export function DemoLoginBox() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState<DemoRole | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDemoEnabled().then(setEnabled);
  }, []);

  if (!enabled) return null;

  async function go(role: DemoRole) {
    setError('');
    setBusy(role);
    try {
      await demoSignIn(role);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Akses demo tidak dapat disediakan.');
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 animate-fade-up rounded-2xl border border-ocean-100 bg-gradient-to-br from-ocean-50 to-white p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-coral-100 text-coral-600">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="font-semibold text-ocean-950">Cuba Sistem Ini</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Tiada pendaftaran diperlukan. Akaun demo sudah diisi dengan tempahan contoh dan tidak menjejaskan data sebenar.
      </p>
      <div className="mt-4 grid gap-3">
        {OPTIONS.map((o) => (
          <button
            key={o.role}
            type="button"
            disabled={busy !== null}
            onClick={() => go(o.role)}
            className="group flex items-center gap-3 rounded-xl border bg-white p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-ocean-300 hover:shadow-md disabled:pointer-events-none disabled:opacity-60"
          >
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', o.tone)}>
              {busy === o.role ? <Loader2 className="h-5 w-5 animate-spin" /> : <o.icon className="h-5 w-5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ocean-950">{o.title}</span>
              <span className="block text-xs leading-relaxed text-muted-foreground">{o.desc}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-ocean-400 transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
      {busy && <p className="mt-3 text-xs text-muted-foreground">Menyediakan akaun demo, sila tunggu sebentar...</p>}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
