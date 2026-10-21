'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell/app-shell';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/lib/supabase';
import { friendlyError, holdHoursFor, toISODate } from '@/lib/format';
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
    return <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">Gagal memuatkan data bilik. Sila muat semula halaman.</p>;
  }

  return (
    <>
      <PageHeader title="Tempahan Baharu" description="Harga bersih ejen dikira secara automatik mengikut musim setiap malam." />

      <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button type="button" disabled={i > step} onClick={() => setStep(i)}
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
        <div key={step} className="animate-fade-up">
          {step === 0 && <StepDates state={state} update={update} holdBlocked={holdBlocked} />}
          {step === 1 && (loadingAvail
            ? <div className="flex items-center gap-2 rounded-2xl border bg-card p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Menyemak kekosongan...</div>
            : <StepRooms quotes={quotes} state={state} update={update} capacity={capacity} />)}
          {step === 2 && <StepAddons state={state} update={update} addons={addons} />}
          {step === 3 && <StepGuest state={state} update={update} />}

          {step === 1 && overbooked && !loadingAvail && (
            <p className="mt-4 text-sm text-coral-700">Bilangan bilik yang dipilih melebihi kekosongan. Sila kurangkan.</p>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
            <Button variant="ghost" disabled={step === 0 || submitting} onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Seterusnya <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button disabled={!canNext || submitting} onClick={submit} className="min-w-[180px]">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Hantar & Kunci Bilik
              </Button>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <BookingSummary state={state} quotes={quotes} totals={totals} holdHours={holdHours} />
        </aside>
      </div>
    </>
  );
}
