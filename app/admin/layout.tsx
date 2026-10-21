'use client';

import {
  BedDouble,
  CalendarRange,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Ship,
  Users,
} from 'lucide-react';
import { AppShell, type NavItem } from '@/components/shell/app-shell';
import { RequireRole } from '@/components/auth/require-role';
import { useAuth } from '@/components/auth/auth-provider';

const COMMON: NavItem[] = [
  { href: '/admin', label: 'Papan Pemuka', icon: LayoutDashboard, exact: true },
  { href: '/admin/bookings', label: 'Semua Tempahan', icon: ListChecks },
  { href: '/admin/payments', label: 'Semakan Bayaran', icon: Receipt },
  { href: '/admin/operations', label: 'Operasi Harian', icon: Ship },
];

const SUPER: NavItem[] = [
  { href: '/admin/agents', label: 'Ejen', icon: Users },
  { href: '/admin/rooms', label: 'Bilik & Harga', icon: BedDouble },
  { href: '/admin/seasons', label: 'Kalendar Musim', icon: CalendarRange },
  { href: '/admin/addons', label: 'Harga Add-On', icon: ClipboardList },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const items = profile?.role === 'super_admin' ? [...COMMON, ...SUPER] : COMMON;
  return (
    <AppShell items={items} home="/admin">
      {children}
    </AppShell>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={['super_admin', 'ops_admin']}>
      <Shell>{children}</Shell>
    </RequireRole>
  );
}
