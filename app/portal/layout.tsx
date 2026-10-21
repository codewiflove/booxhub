'use client';

import { CalendarDays, LayoutDashboard, ListChecks, PlusCircle, UserCircle } from 'lucide-react';
import { AppShell, type NavItem } from '@/components/shell/app-shell';
import { RequireRole } from '@/components/auth/require-role';

const NAV: NavItem[] = [
  { href: '/portal', label: 'Papan Pemuka', icon: LayoutDashboard, exact: true },
  { href: '/portal/book', label: 'Tempahan Baharu', icon: PlusCircle },
  { href: '/portal/bookings', label: 'Tempahan Saya', icon: ListChecks },
  { href: '/portal/calendar', label: 'Kalendar Bilik', icon: CalendarDays },
  { href: '/portal/profile', label: 'Profil Agensi', icon: UserCircle },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={['agent']}>
      <AppShell items={NAV} home="/portal">
        {children}
      </AppShell>
    </RequireRole>
  );
}
