import { Ship, Car, Waves } from 'lucide-react';
import { formatDate, formatRM, SEASON_META, VAN_LABEL } from '@/lib/format';
import { balanceOf } from '@/lib/bookings';
import type { Booking } from '@/lib/types';

function Row({ label, value, strong }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-2 text-sm ${strong ? 'font-semibold text-ocean-950' : ''}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular text-right">{value}</span>
    </div>
  );
}

export function BookingPricing({ booking }: { booking: Booking }) {
  const groups = new Map<string, { room: string; season: string; rate: number; nights: number; qty: number }>();
  for (const n of booking.nightly_breakdown ?? []) {
    const key = `${n.room}|${n.season}|${n.rate}|${n.quantity}`;
    const g = groups.get(key);
    if (g) g.nights += 1;
    else groups.set(key, { room: n.room, season: n.season, rate: Number(n.rate), nights: 1, qty: n.quantity });
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="font-semibold text-ocean-950">Pecahan harga bersih</h3>
      <div className="mt-3 divide-y">
        {Array.from(groups.values()).map((g, i) => (
          <Row
            key={i}
            label={
              <span>
                {g.qty} x {g.room}
                <span className="block text-xs">
                  {g.nights} malam {SEASON_META[g.season as keyof typeof SEASON_META]?.label ?? g.season} @ {formatRM(g.rate)}
                </span>
              </span>
            }
            value={formatRM(g.rate * g.nights * g.qty)}
          />
        ))}
        {booking.include_boat && (
          <Row
            label={<span className="flex items-center gap-2"><Ship className="h-3.5 w-3.5" /> Speedboat pergi-balik ({booking.boat_adult} dewasa, {booking.boat_child} kanak-kanak)</span>}
            value={formatRM(booking.boat_total)}
          />
        )}
        {booking.van_type !== 'none' && (
          <Row
            label={<span className="flex items-center gap-2"><Car className="h-3.5 w-3.5" /> Van KBR {VAN_LABEL[booking.van_type].toLowerCase()} ({booking.van_adult + booking.van_child} pax)</span>}
            value={formatRM(booking.van_total)}
          />
        )}
        {booking.snorkel_adult + booking.snorkel_child > 0 && (
          <Row
            label={<span className="flex items-center gap-2"><Waves className="h-3.5 w-3.5" /> Snorkeling ({booking.snorkel_adult} dewasa, {booking.snorkel_child} kanak-kanak)</span>}
            value={formatRM(booking.snorkel_total)}
          />
        )}
        <Row label="Jumlah keseluruhan" value={formatRM(booking.grand_total)} strong />
      </div>
      <div className="mt-4 space-y-1 rounded-xl bg-muted/60 p-4">
        <Row label="Deposit wajib (25%)" value={formatRM(booking.deposit_required)} />
        <Row label="Telah dibayar" value={formatRM(booking.paid_amount)} />
        <Row label={`Baki (sebelum ${formatDate(booking.balance_due_date)})`} value={formatRM(balanceOf(booking))} strong />
      </div>
    </div>
  );
}
