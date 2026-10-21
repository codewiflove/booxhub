'use client';

import { PageHeader } from '@/components/shell/app-shell';
import { BookingTable } from '@/components/booking/booking-table';

export default function AdminBookingsPage() {
  return (
    <>
      <PageHeader title="Semua Tempahan" description="Pantau semua tempahan ejen, status hold dan bayaran." />
      <BookingTable viewer="staff" />
    </>
  );
}
