'use client';

import { CalendarDays, Home, LayoutDashboard, ListChecks, Plus, PlusCircle, Ticket, UserCircle } from 'lucide-react';
import { AppShell, type NavItem, type NavSection, type TabItem } from '@/components/shell/app-shell';
import { RequireRole } from '@/components/auth/require-role';

const NAV: NavItem[] = [
  { href: '/portal', label: 'Papan Pemuka', icon: LayoutDashboard, exact: true },
  { href: '/portal/book', label: 'Tempahan Baharu', icon: PlusCircle },
  { href: '/portal/bookings', label: 'Tempahan Saya', icon: ListChecks },
  { href: '/portal/calendar', label: 'Kalendar Bilik', icon: CalendarDays },
  { href: '/portal/profile', label: 'Profil Agensi', icon: UserCircle },
];

const SECTIONS: NavSection[] = [
  { label: 'Tempahan', items: NAV.slice(0, 4) },
  { label: 'Akaun', items: [NAV[4]] },
];

const TABS: TabItem[] = [
  { href: '/portal', label: 'Utama', icon: Home, exact: true },
  { href: '/portal/bookings', label: 'Tempahan', icon: Ticket },
  { href: '/portal/book', label: 'Tempah', icon: Plus, primary: true },
  { href: '/portal/calendar', label: 'Kalendar', icon: CalendarDays },
  { href: '/portal/profile', label: 'Profil', icon: UserCircle },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={['agent']}>
      <AppShell sections={SECTIONS} items={NAV} tabs={TABS} home="/portal">
        {children}
      </AppShell>
    </RequireRole>
  );
}
