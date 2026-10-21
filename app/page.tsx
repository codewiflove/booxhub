'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  Car,
  FileText,
  Lock,
  ShieldCheck,
  Ship,
  Timer,
  Waves,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';
import { useAuth, homePathFor } from '@/components/auth/auth-provider';
import { cn } from '@/lib/utils';

const HERO =
  'https://images.pexels.com/photos/6559967/pexels-photo-6559967.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';
const ISLAND =
  'https://images.pexels.com/photos/11061325/pexels-photo-11061325.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const FEATURES = [
  { icon: BadgeCheck, title: 'Harga bersih tetap', text: 'Harga dikira automatik ikut musim dan malam. Tiada lagi salah kira atau tawar-menawar.' },
  { icon: Timer, title: 'Hold pintar 48 / 24 / 1 jam', text: 'Bilik dikunci sebaik tempahan dihantar, dengan kiraan detik jelas sehingga deposit 25% dibayar.' },
  { icon: Ship, title: 'Bot & van dalam satu klik', text: 'Tambah speedboat Kuala Besut, van KBR dan snorkeling pada kadar kombo khas ejen.' },
  { icon: FileText, title: 'Proforma & baucar segera', text: 'Muat turun sebut harga serta-merta, dan baucar pelanggan tanpa harga kos sebaik deposit disahkan.' },
];

const HOLD_RULES = [
  { range: 'Lebih 14 hari', hours: '48 jam', tone: 'bg-emerald-500' },
  { range: '4 hingga 14 hari', hours: '24 jam', tone: 'bg-sand-500' },
  { range: 'Kurang 3 hari', hours: '1 jam', tone: 'bg-coral-500' },
];

const STEPS = [
  { n: '01', title: 'Pilih tarikh & bilik', text: 'Lihat baki bilik masa nyata pada kalendar inventori.' },
  { n: '02', title: 'Tambah pengangkutan', text: 'Bot dan van dikunci bersama penginapan.' },
  { n: '03', title: 'Bayar deposit 25%', text: 'Muat naik resit dalam tempoh hold untuk mengesahkan.' },
  { n: '04', title: 'Jelaskan baki 75%', text: '7 hari sebelum check-in. Baucar terus dihantar ke pelanggan.' },
];

export default function Home() {
  const { profile, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const portalHref = profile ? homePathFor(profile) : '/login';

  return (
    <div className="bg-background">
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 transition-all duration-300',
          scrolled ? 'border-b bg-background/95 py-3 shadow-sm backdrop-blur' : 'py-5'
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Logo light={!scrolled} />
          <div className="flex items-center gap-2">
            {!loading && profile ? (
              <Button asChild className={cn(!scrolled && 'bg-white text-ocean-900 hover:bg-white/90')}>
                <Link href={portalHref}>Buka Portal</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className={cn('hidden sm:inline-flex', !scrolled && 'text-white hover:bg-white/10 hover:text-white')}>
                  <Link href="/login">Log Masuk</Link>
                </Button>
                <Button asChild className={cn(!scrolled && 'bg-white text-ocean-900 hover:bg-white/90')}>
                  <Link href="/register">Daftar Ejen</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative flex min-h-[92vh] items-end overflow-hidden">
        <img src={HERO} alt="Jeti dan pantai Perhentian" className="absolute inset-0 h-full w-full scale-105 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ocean-950/90 via-ocean-950/60 to-ocean-950/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-ocean-950/70 via-transparent to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-20 pt-40">
          <div className="max-w-2xl animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sand-200 ring-1 ring-white/20">
              <Waves className="h-3.5 w-3.5" /> Perhentian Bay Chalet x Perhentian Gateway
            </span>
            <h1 className="mt-6 font-display text-4xl text-white sm:text-6xl">
              Tempahan ejen paling pantas ke Pulau Perhentian.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/80">
              Bilik, speedboat dan van lapangan terbang dalam satu tempahan, pada harga bersih yang tetap. Tanpa WhatsApp, tanpa Excel, tanpa salah kira.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg" className="group h-12 bg-sand-300 px-6 text-ocean-950 hover:bg-sand-200">
                <Link href={profile ? portalHref : '/register'}>
                  {profile ? 'Buka Portal' : 'Mohon Akaun Ejen'}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              {!profile && (
                <Button asChild size="lg" variant="outline" className="h-12 border-white/40 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white">
                  <Link href="/login">Saya sudah berdaftar</Link>
                </Button>
              )}
            </div>
          </div>
          <div className="mt-16 grid max-w-3xl grid-cols-3 gap-4 text-white">
            {[
              ['34', 'unit bilik'],
              ['25%', 'deposit sahaja'],
              ['< 1 min', 'masa menempah'],
            ].map(([n, l], i) => (
              <div key={l} className="animate-fade-up border-l border-white/25 pl-4" style={{ animationDelay: `${200 + i * 120}ms` }}>
                <p className="font-display text-3xl">{n}</p>
                <p className="text-sm text-white/70">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ocean-600">Kenapa ejen memilih kami</p>
          <h2 className="mt-3 font-display text-3xl text-ocean-950 sm:text-4xl">Semua yang anda perlukan untuk menjual pakej pulau.</h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-ocean-200 hover:shadow-xl hover:shadow-ocean-900/5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ocean-50 text-ocean-700 transition-colors group-hover:bg-ocean-700 group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-ocean-950">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ocean-950 py-24 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sand-300">Hold adil untuk semua</p>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl">Bilik dikunci untuk anda, bukan selama-lamanya.</h2>
            <p className="mt-4 text-ocean-100/80">
              Tempoh hold ditentukan automatik mengikut jarak ke tarikh check-in. Jika deposit tidak diterima, bilik dilepaskan semula supaya ejen lain boleh menempah.
            </p>
            <div className="mt-10 space-y-3">
              {HOLD_RULES.map((r) => (
                <div key={r.range} className="flex items-center justify-between rounded-xl bg-white/5 px-5 py-4 ring-1 ring-white/10 transition-colors hover:bg-white/10">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${r.tone}`} />
                    <span className="text-sm text-ocean-100">Check-in {r.range.toLowerCase()} lagi</span>
                  </div>
                  <span className="flex items-center gap-2 font-semibold">
                    <Lock className="h-4 w-4 text-sand-300" /> {r.hours}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <img src={ISLAND} alt="Resort pulau dari udara" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-2xl" />
            <div className="absolute -bottom-6 -left-4 animate-float rounded-2xl bg-white p-5 text-ocean-950 shadow-xl sm:-left-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-muted-foreground">PBC-2610-8841</p>
                  <p className="font-semibold">Deposit disahkan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-ocean-600">Cara ia berfungsi</p>
          <h2 className="mt-3 font-display text-3xl text-ocean-950 sm:text-4xl">Empat langkah, satu tempahan lengkap.</h2>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-2xl bg-sand-50 p-6 ring-1 ring-sand-200/70">
              <p className="font-display text-4xl text-sand-400">{s.n}</p>
              <h3 className="mt-4 font-semibold text-ocean-950">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col items-center gap-6 rounded-3xl bg-gradient-to-br from-ocean-700 to-ocean-900 px-8 py-14 text-center text-white">
          <div className="flex gap-3 text-sand-200">
            <CalendarCheck2 className="h-6 w-6" /> <Ship className="h-6 w-6" /> <Car className="h-6 w-6" />
          </div>
          <h2 className="max-w-xl font-display text-3xl">Sedia untuk berhenti menempah melalui WhatsApp?</h2>
          <Button asChild size="lg" className="h-12 bg-white px-8 text-ocean-900 hover:bg-sand-50">
            <Link href={profile ? portalHref : '/register'}>{profile ? 'Buka Portal' : 'Daftar Sekarang'}</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground sm:flex-row">
          <Logo />
          <p>Perhentian Bay Chalet, Pulau Perhentian, Terengganu. Portal untuk rakan kongsi berdaftar sahaja.</p>
        </div>
      </footer>
    </div>
  );
}
