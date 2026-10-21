export type Role = 'super_admin' | 'ops_admin' | 'agent';
export type AccountStatus = 'pending' | 'approved' | 'suspended';
export type Season = 'LOW_MONSOON' | 'NORMAL_WEEKDAY' | 'WEEKEND' | 'PEAK_HOLIDAY';
export type BookingStatus =
  | 'PENDING_DEPOSIT'
  | 'CONFIRMED_PARTIAL'
  | 'FULLY_PAID'
  | 'EXPIRED'
  | 'CANCELLED';
export type PaymentKind = 'DEPOSIT_25' | 'BALANCE_75' | 'FULL_100';
export type PaymentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type VanType = 'none' | 'one_way' | 'return';
export type AddonKey = 'boat_return' | 'van_one_way' | 'van_return' | 'snorkeling';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  phone: string;
  license_no: string;
  role: Role;
  status: AccountStatus;
  consecutive_expired: number;
  hold_blocked: boolean;
  is_demo: boolean;
  created_at: string;
}

export interface RoomType {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  total_units: number;
  max_adults: number;
  max_children: number;
  rate_low_monsoon: number;
  rate_normal_weekday: number;
  rate_weekend: number;
  rate_peak_holiday: number;
  sort_order: number;
  is_active: boolean;
}

export interface SeasonRange {
  id: string;
  label: string;
  season_type: Season;
  start_date: string;
  end_date: string;
}

export interface AddonRate {
  key: AddonKey;
  name: string;
  description: string;
  price_adult: number;
  price_child: number;
  sort_order: number;
}

export interface AvailabilityRow {
  day: string;
  room_type_id: string;
  total_units: number;
  booked: number;
  blocked: number;
  available: number;
  season: Season;
  rate: number;
}

export interface BookingRoom {
  id: string;
  room_type_id: string;
  room_name: string;
  quantity: number;
  subtotal: number;
}

export interface Booking {
  id: string;
  code: string;
  agent_id: string;
  status: BookingStatus;
  hold_hours: number;
  hold_expires_at: string;
  requires_immediate_payment: boolean;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  lead_guest_name: string;
  lead_guest_phone: string;
  notes: string;
  nightly_breakdown: { date: string; room: string; season: Season; rate: number; quantity: number }[];
  room_total: number;
  include_boat: boolean;
  boat_adult: number;
  boat_child: number;
  boat_total: number;
  van_type: VanType;
  van_adult: number;
  van_child: number;
  flight_number: string;
  flight_arrival_time: string;
  van_total: number;
  snorkel_adult: number;
  snorkel_child: number;
  snorkel_total: number;
  grand_total: number;
  deposit_required: number;
  paid_amount: number;
  balance_due_date: string;
  expired_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string;
  created_at: string;
  booking_rooms?: BookingRoom[];
  payments?: { status: PaymentStatus }[];
  profiles?: Pick<Profile, 'company_name' | 'full_name' | 'phone' | 'email'> | null;
}

export interface Payment {
  id: string;
  booking_id: string;
  agent_id: string;
  kind: PaymentKind;
  method: 'MANUAL_RECEIPT' | 'FPX_BAYARCASH';
  amount: number;
  reference: string;
  receipt_path: string;
  status: PaymentStatus;
  reviewed_at: string | null;
  review_note: string;
  created_at: string;
}

export interface BookingEvent {
  id: string;
  event: string;
  detail: string;
  created_at: string;
}
