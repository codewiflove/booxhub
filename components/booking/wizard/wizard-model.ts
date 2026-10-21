import type { AddonRate, AddonKey, AvailabilityRow, RoomType, VanType } from '@/lib/types';

export interface WizardState {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: Record<string, number>;
  includeBoat: boolean;
  vanType: VanType;
  flightNumber: string;
  flightArrivalTime: string;
  snorkelAdult: number;
  snorkelChild: number;
  leadName: string;
  leadPhone: string;
  notes: string;
}

export interface RoomQuote {
  room: RoomType;
  minAvailable: number;
  perUnit: number;
  nights: AvailabilityRow[];
}

export function quoteRooms(roomTypes: RoomType[], availability: AvailabilityRow[]): RoomQuote[] {
  return roomTypes.map((room) => {
    const nights = availability.filter((a) => a.room_type_id === room.id);
    return {
      room,
      nights,
      minAvailable: nights.length ? Math.min(...nights.map((n) => n.available)) : 0,
      perUnit: nights.reduce((s, n) => s + Number(n.rate), 0),
    };
  });
}

export function computeTotals(state: WizardState, quotes: RoomQuote[], addons: AddonRate[]) {
  const rate = (k: AddonKey) => addons.find((a) => a.key === k);
  const roomTotal = quotes.reduce((s, q) => s + q.perUnit * (state.rooms[q.room.id] ?? 0), 0);
  const boat = rate('boat_return');
  const boatTotal = state.includeBoat && boat ? boat.price_adult * state.adults + boat.price_child * state.children : 0;
  const van = state.vanType === 'none' ? undefined : rate(state.vanType === 'one_way' ? 'van_one_way' : 'van_return');
  const vanTotal = van ? van.price_adult * state.adults + van.price_child * state.children : 0;
  const sn = rate('snorkeling');
  const snorkelTotal = sn ? sn.price_adult * state.snorkelAdult + sn.price_child * state.snorkelChild : 0;
  const grand = roomTotal + boatTotal + vanTotal + snorkelTotal;
  return {
    roomTotal,
    boatTotal,
    vanTotal,
    snorkelTotal,
    grand,
    deposit: Math.round(grand * 25) / 100,
  };
}

export function capacityOf(state: WizardState, quotes: RoomQuote[]) {
  let adults = 0;
  let total = 0;
  for (const q of quotes) {
    const qty = state.rooms[q.room.id] ?? 0;
    adults += q.room.max_adults * qty;
    total += (q.room.max_adults + q.room.max_children) * qty;
  }
  const units = Object.values(state.rooms).reduce((s, n) => s + n, 0);
  const ok = units > 0 && state.adults <= adults && state.adults + state.children <= total;
  return { adults, total, units, ok };
}
