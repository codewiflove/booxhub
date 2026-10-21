'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shell/app-shell';
import { BookingTable } from '@/components/booking/booking-table';

export default function AgentBookingsPage() {
  return (
    <>
      <PageHeader
        title="Tempahan Saya"
        description="Semua tempahan agensi anda, termasuk status hold dan bayaran."
        actions={<Button asChild className="hidden sm:inline-flex"><Link href="/portal/book"><Plus className="mr-2 h-4 w-4" /> Tempahan Baharu</Link></Button>}
      />
      <BookingTable viewer="agent" />
    </>
  );
}
