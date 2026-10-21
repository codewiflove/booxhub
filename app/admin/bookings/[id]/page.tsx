'use client';

import { BookingDetail } from '@/components/booking/booking-detail';

export default function AdminBookingPage({ params }: { params: { id: string } }) {
  return <BookingDetail id={params.id} viewer="staff" />;
}
