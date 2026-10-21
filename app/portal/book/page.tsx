'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { ArrowLeft, ArrowRight, Check, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { PageHeader } from '@/components/shell/app-shell';
import { SkeletonList } from '@/components/shell/stat-card';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/lib/supabase';
import { formatRM, friendlyError, holdHoursFor, toISODate } from '@/lib/format';
import type { AddonRate, AvailabilityRow, RoomType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StepDates } from '@/components/booking/wizard/step-dates';
import { StepRooms } from '@/components/booking/wizard/step-rooms';
import { StepAddons } from '@/components/booking/wizard/step-addons';
import { StepGuest } from '@/components/booking/wizard/step-guest';
import { BookingSummary } from '@/components/booking/wizard/booking-summary';
import { capacityOf, computeTotals, quoteRooms, type WizardState } from '@/components/booking/wizard/wizard-model';

const STEPS = ['Tarikh & Tetamu', 'Pilih Bilik', 'Tambahan', 'Maklumat Tetamu'];

const INITIAL: WizardState = {
  checkIn: '', checkOut: '', adults: 2, children: 0, rooms: {},
  includeBoat: true, vanType: 'none', flightNumber: '', flightArrivalTime: '',
  snorkelAdult: 0, snorkelChild: 0, leadName: '', leadPhone: '', notes: '',
};

export default function NewBookingPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [addons, setAddons] = useState<AddonRate[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (patch: Partial<WizardState>) => setState((s) => {
    const next = { ...s, ...patch };
    next.snorkelAdult = Math.min(next.snorkelAdult, next.adults);
    next.snorkelChild = Math.min(next.snorkelChild, next.children);
    return next;
  });

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const ci = q.get('ci') ?? '';
    const co = q.get('co') ?? '';
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if (!iso.test(ci) || !iso.test(co) || co <= ci) return;
    const count = (v: string | null, min: number) => Math.min(200, Math.max(min, Number.parseInt(v ?? '', 10) || min));
    setState((s) => ({ ...s, checkIn: ci, checkOut: co, adults: count(q.get('a'), 1), children: count(q.get('c'), 0) }));
    setStep(1);
  }, []);

  useEffect(() => {
    (async () => {
      const [r, a] = await Promise.all([
        supabase.from('room_types').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('addon_rates').select('*').order('sort_order'),
      ]);
      if (r.error || a.error) {
        setLoadError(true);
        friendlyError(r.error || a.error, '');
        return;
      }
      setRoomTypes((r.data ?? []) as RoomType[]);
      setAddons((a.data ?? []) as AddonRate[]);
    })();
  }, []);

  const nights = state.checkIn && state.checkOut
    ? differenceInCalendarDays(parseISO(state.checkOut), parseISO(state.checkIn)) : 0;
  const datesValid = nights >= 1 && nights <= 30 && state.adults >= 1;

  useEffect(() => {
    if (!datesValid) { setAvailability([]); return; }
    let cancelled = false;
    setLoadingAvail(true);
    (async () => {
      const { data, error } = await supabase.rpc('get_availability', {
        p_start: state.checkIn,
        p_end: toISODate(addDays(parseISO(state.checkOut), -1)),
      });
      if (cancelled) return;
      setLoadingAvail(false);
      if (error) { toast.error(friendlyError(error, 'Gagal menyemak kekosongan bilik.')); return; }
      setAvailability((data ?? []) as AvailabilityRow[]);
    })();
    return () => { cancelled = true; };
  }, [state.checkIn, state.checkOut, datesValid]);

  const quotes = useMemo(() => quoteRooms(roomTypes, availability), [roomTypes, availability]);
  const capacity = capacityOf(state, quotes);
  const totals = computeTotals(state, quotes, addons);
  const holdBlocked = !!profile?.hold_blocked;
  const holdHours = state.checkIn ? (holdBlocked ? 1 : holdHoursFor(state.checkIn)) : null;
  const overbooked = quotes.some((q) => (state.rooms[q.room.id] ?? 0) > q.minAvailable);

  const canNext = [
    datesValid,
    capacity.ok && !overbooked && !loadingAvail,
    state.vanType === 'none' || state.flightNumber.trim().length >= 3,
    state.leadName.trim().length >= 2,
  ][step];

  const submit = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.rpc('create_booking', {
      p: {
        check_in: state.checkIn,
        check_out: state.checkOut,
        adults: state.adults,
        children: state.children,
        rooms: Object.entries(state.rooms).filter(([, q]) => q > 0).map(([room_type_id, quantity]) => ({ room_type_id, quantity })),
        include_boat: state.includeBoat,
        van_type: state.vanType,
        flight_number: state.vanType === 'none' ? '' : state.flightNumber.trim(),
        flight_arrival_time: state.vanType === 'none' ? '' : state.flightArrivalTime,
        snorkel_adult: state.snorkelAdult,
        snorkel_child: state.snorkelChild,
        lead_guest_name: state.leadName.trim(),
        lead_guest_phone: state.leadPhone.trim(),
        notes: state.notes.trim(),
      },
    });
    if (error || typeof data !== 'string') {
      setSubmitting(false);
      toast.error(friendlyError(error, 'Tempahan gagal dihantar. Sila cuba lagi.'));
      return;
    }
    toast.success('Tempahan dihantar. Bilik anda kini dikunci.');
    router.push(`/portal/bookings/${data}`);
  };

  if (loadError) {
    return <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Gagal memuatkan data bilik. Sila muat semula halaman.</p>;
  }

  const goTo = (s: number) => { setStep(s); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const isLast = step === STEPS.length - 1;
  const primaryAction = isLast ? submit : () => goTo(step + 1);
  const primaryDisabled = !canNext || submitting;

  return (
    <>
      <PageHeader title="Tempahan Baharu" description="Harga bersih ejen dikira secara automatik mengikut musim setiap malam." />

      <div className="mb-6 sm:hidden">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-ocean-950">{STEPS[step]}</span>
          <span className="text-muted-foreground">Langkah {step + 1} / {STEPS.length}</span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {STEPS.map((label, i) => (
            <button key={label} type="button" disabled={i > step} onClick={() => goTo(i)} aria-label={label}
              className={cn('h-1.5 rounded-full transition-colors duration-500', i <= step ? 'bg-ocean-600' : 'bg-ocean-100')} />
          ))}
        </div>
      </div>

      <ol className="mb-8 hidden grid-cols-4 gap-2 sm:grid">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button type="button" disabled={i > step} onClick={() => goTo(i)}
              className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                i === step ? 'border-ocean-600 bg-ocean-700 text-white' : i < step ? 'bg-ocean-50 text-ocean-900 hover:bg-ocean-100' : 'bg-card text-muted-foreground')}>
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                i === step ? 'bg-white text-ocean-800' : i < step ? 'bg-ocean-600 text-white' : 'bg-muted')}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="truncate font-medium">{label}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div key={step} className="">
          {step === 0 && <StepDates state={state} update={update} holdBlocked={holdBlocked} />}
          {step === 1 && (loadingAvail
            ? <SkeletonList rows={3} />
            : <StepRooms quotes={quotes} state={state} update={update} capacity={capacity} />)}
          {step === 2 && <StepAddons state={state} update={update} addons={addons} />}
          {step === 3 && <StepGuest state={state} update={update} />}

          {step === 1 && overbooked && !loadingAvail && (
            <p className="mt-4 text-sm text-coral-700">Bilangan bilik yang dipilih melebihi kekosongan. Sila kurangkan.</p>
          )}

          <div className="mt-8 hidden items-center justify-between gap-3 border-t pt-6 lg:flex">
            <Button variant="ghost" disabled={step === 0 || submitting} onClick={() => goTo(step - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
            <Button variant={isLast ? 'cta' : 'default'} disabled={primaryDisabled} onClick={primaryAction} className="min-w-[180px]">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLast ? <><Check className="mr-2 h-4 w-4" /> Hantar & Kunci Bilik</> : <>Seterusnya <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </div>
          <div className="h-24 lg:hidden" aria-hidden />
        </div>

        <aside className="hidden lg:sticky lg:top-8 lg:block lg:self-start">
          <BookingSummary state={state} quotes={quotes} totals={totals} holdHours={holdHours} />
        </aside>
      </div>

      <div className="no-print fixed inset-x-0 bottom-[calc(61px+env(safe-area-inset-bottom))] z-30 border-t border-ocean-950/5 bg-white/95 px-4 py-3 shadow-dock backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {step > 0 && (
            <Button variant="outline" size="icon" className="shrink-0 rounded-full" disabled={submitting} onClick={() => goTo(step - 1)} aria-label="Kembali">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Drawer>
            <DrawerTrigger asChild>
              <button type="button" className="tap min-w-0 flex-1 text-left">
                <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Jumlah bersih <ChevronUp className="h-3.5 w-3.5" />
                </span>
                <span className="block truncate font-sans text-xl leading-tight text-ocean-950 tabular">{formatRM(totals.grand)}</span>
                <span className="block truncate text-xs font-medium text-sand-800">Deposit 25%: {formatRM(totals.deposit)}</span>
              </button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[85vh]">
              <DrawerTitle className="sr-only">Ringkasan tempahan</DrawerTitle>
              <div className="overflow-y-auto p-4 pb-safe">
                <BookingSummary state={state} quotes={quotes} totals={totals} holdHours={holdHours} />
              </div>
            </DrawerContent>
          </Drawer>
          <Button variant="cta" size="lg" disabled={primaryDisabled} onClick={primaryAction} className="shrink-0 rounded-full px-6">
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : isLast ? 'Hantar' : 'Teruskan'}
          </Button>
        </div>
      </div>
    </>
  );
}
