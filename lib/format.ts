import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { ms } from 'date-fns/locale';
import type { BookingStatus, Season, PaymentKind, PaymentStatus } from './types';

const rm = new Intl.NumberFormat('ms-MY', {
  style: 'currency',
  currency: 'MYR',
  minimumFractionDigits: 2,
});

export function formatRM(value: number | string | null | undefined) {
  return rm.format(Number(value ?? 0));
}

export function formatDate(value: string, pattern = 'd MMM yyyy') {
  return format(parseISO(value), pattern, { locale: ms });
}

export function formatDateTime(value: string) {
  return format(parseISO(value), 'd MMM yyyy, h:mm a', { locale: ms });
}

export function toISODate(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

export function malaysiaToday() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 3600000);
}

export function holdHoursFor(checkIn: string) {
  const days = differenceInCalendarDays(parseISO(checkIn), malaysiaToday());
  if (days > 14) return 48;
  if (days >= 4) return 24;
  return 1;
}

export const SEASON_META: Record<Season, { label: string; short: string; className: string; dot: string }> = {
  LOW_MONSOON: {
    label: 'Musim Tengkujuh',
    short: 'Tengkujuh',
    className: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-sky-400',
  },
  NORMAL_WEEKDAY: {
    label: 'Hari Biasa',
    short: 'Biasa',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  WEEKEND: {
    label: 'Hujung Minggu',
    short: 'Hujung Minggu',
    className: 'bg-sand-100 text-sand-800 border-sand-200',
    dot: 'bg-sand-500',
  },
  PEAK_HOLIDAY: {
    label: 'Musim Puncak / Cuti',
    short: 'Puncak',
    className: 'bg-coral-50 text-coral-800 border-coral-200',
    dot: 'bg-coral-500',
  },
};

export const STATUS_META: Record<BookingStatus, { label: string; short: string; className: string; action: string }> = {
  PENDING_DEPOSIT: {
    label: 'Menunggu Deposit',
    short: 'Deposit',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
    action: 'Bilik dikunci sementara menunggu resit deposit 25%. Muat naik resit sebelum tempoh tamat.',
  },
  CONFIRMED_PARTIAL: {
    label: 'Disahkan (Deposit)',
    short: 'Deposit Diterima',
    className: 'bg-ocean-50 text-ocean-800 border-ocean-200',
    action: 'Tempahan disahkan. Baki 75% perlu dijelaskan sebelum tarikh akhir.',
  },
  FULLY_PAID: {
    label: 'Dibayar Penuh',
    short: 'Selesai',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    action: 'Selesai — sedia untuk daftar masuk.',
  },
  EXPIRED: {
    label: 'Tamat Tempoh',
    short: 'Tamat',
    className: 'bg-slate-100 text-slate-600 border-slate-200',
    action: 'Tempahan tamat tempoh kerana resit deposit tidak dihantar dalam masa.',
  },
  CANCELLED: {
    label: 'Dibatalkan',
    short: 'Batal',
    className: 'bg-red-50 text-red-700 border-red-200',
    action: 'Tempahan dibatalkan.',
  },
};

export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = {
  DEPOSIT_25: 'Deposit 25%',
  BALANCE_75: 'Baki 75%',
  FULL_100: 'Bayaran Penuh 100%',
};

export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; className: string; action: string }> = {
  PENDING: { label: 'Sedang Disemak', className: 'bg-amber-50 text-amber-800 border-amber-200', action: 'Resit diterima & bilik kekal selamat. Pasukan kewangan sedang menyemak.' },
  VERIFIED: { label: 'Disahkan', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', action: 'Bayaran disahkan. Baki atau tempahan telah dikemas kini.' },
  REJECTED: { label: 'Ditolak', className: 'bg-red-50 text-red-700 border-red-200', action: 'Pengesahan bayaran tidak berjaya. Sila muat naik semula resit yang jelas.' },
};

export const VAN_LABEL = { none: 'Tiada', one_way: 'Sehala', return: 'Dua Hala' } as const;

export function friendlyError(error: unknown, fallback: string) {
  console.error(error);
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === 'P0001' && e.message && e.message !== 'Not authorized' && e.message.length < 160) {
    return e.message;
  }
  return fallback;
}
