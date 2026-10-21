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
    tone: 'bg-gradient-to-br from-ocean-700 to-ocean-950 text-white',
  },
  {
    role: 'agent',
    title: 'Masuk sebagai Ejen',
    desc: 'Masuk sebagai BLUE STAR: buat tempahan, muat naik resit, cetak proforma & baucar tetamu.',
    icon: Briefcase,
    tone: 'bg-gradient-to-br from-sand-200 to-sand-400 text-ocean-950',
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
    <div className="mb-6">
    <div className="rounded-lg border border-coral-100 bg-gradient-to-br from-coral-50 via-white to-sand-50 p-4 shadow-stripe-card sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-coral-400 to-coral-600 text-white shadow-cta">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="font-semibold text-ocean-950">Cuba demo, tanpa daftar</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Akaun demo sudah diisi dengan tempahan contoh dan tidak menjejaskan data sebenar.
      </p>
      <div className="mt-4 grid gap-3">
        {OPTIONS.map((o) => (
          <button
            key={o.role}
            type="button"
            disabled={busy !== null}
            onClick={() => go(o.role)}
            className="tap group flex min-h-[72px] items-center gap-3 rounded-lg border border-ocean-950/[0.06] bg-white p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-ocean-300 hover:shadow-stripe-card disabled:pointer-events-none disabled:opacity-60"
          >
            <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', o.tone)}>
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
      <div className="mt-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> atau log masuk dengan emel <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
