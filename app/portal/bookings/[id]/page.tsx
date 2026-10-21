'use client';

import { BookingDetail } from '@/components/booking/booking-detail';

export default function AgentBookingPage({ params }: { params: { id: string } }) {
  return <BookingDetail id={params.id} viewer="agent" />;
}
