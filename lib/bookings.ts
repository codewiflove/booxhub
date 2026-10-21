import { supabase } from './supabase';
import type { Booking, BookingEvent, Payment } from './types';

export const BOOKING_LIST_SELECT =
  'id, code, agent_id, status, hold_hours, hold_expires_at, requires_immediate_payment, check_in, check_out, nights, adults, children, lead_guest_name, grand_total, deposit_required, paid_amount, balance_due_date, include_boat, van_type, created_at, booking_rooms(id, room_type_id, room_name, quantity, subtotal), payments(status), profiles(company_name, full_name, phone, email)';

export async function fetchBookingBundle(id: string) {
  const [b, p, e] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, booking_rooms(*), profiles(company_name, full_name, phone, email)')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('payments').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
    supabase.from('booking_events').select('id, event, detail, created_at').eq('booking_id', id).order('created_at', { ascending: false }),
  ]);
  if (b.error || p.error || e.error) throw b.error || p.error || e.error;
  return {
    booking: b.data as Booking | null,
    payments: (p.data ?? []) as Payment[],
    events: (e.data ?? []) as BookingEvent[],
  };
}

export function hasPendingPayment(payments: Pick<Payment, 'status'>[]) {
  return payments.some((p) => p.status === 'PENDING');
}

export function isHoldLapsed(b: Pick<Booking, 'status' | 'hold_expires_at'>, pendingPayment = false) {
  return b.status === 'PENDING_DEPOSIT' && !pendingPayment && new Date(b.hold_expires_at).getTime() <= Date.now();
}

export function balanceOf(b: Pick<Booking, 'grand_total' | 'paid_amount'>) {
  return Math.max(0, Number(b.grand_total) - Number(b.paid_amount));
}
