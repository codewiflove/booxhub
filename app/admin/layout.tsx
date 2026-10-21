'use client';

import {
  BarChart3,
  BedDouble,
  CalendarRange,
  CalendarClock,
  ClipboardList,
  Home,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Settings,
  Ship,
  Users,
} from 'lucide-react';
import { AppShell, type NavItem, type NavSection, type TabItem } from '@/components/shell/app-shell';
import { RequireRole } from '@/components/auth/require-role';
import { useAuth } from '@/components/auth/auth-provider';

const COMMON: NavItem[] = [
  { href: '/admin', label: 'Papan Pemuka', icon: LayoutDashboard, exact: true },
  { href: '/admin/bookings', label: 'Semua Tempahan', icon: ListChecks },
  { href: '/admin/payments', label: 'Semakan Bayaran', icon: Receipt },
  { href: '/admin/operations', label: 'Operasi Harian', icon: Ship },
  { href: '/admin/reports', label: 'Laporan Jualan', icon: BarChart3 },
];

const SUPER: NavItem[] = [
  { href: '/admin/agents', label: 'Ejen', icon: Users },
  { href: '/admin/rooms', label: 'Bilik & Harga', icon: BedDouble },
  { href: '/admin/seasons', label: 'Kalendar Musim', icon: CalendarRange },
  { href: '/admin/addons', label: 'Harga Add-On', icon: ClipboardList },
  { href: '/admin/blocks', label: 'Blok Bilik & OTA', icon: CalendarClock },
  { href: '/admin/settings', label: 'Tetapan Syarikat', icon: Settings },
];

const TABS: TabItem[] = [
  { href: '/admin', label: 'Utama', icon: Home, exact: true },
  { href: '/admin/bookings', label: 'Tempahan', icon: ListChecks },
  { href: '/admin/payments', label: 'Bayaran', icon: Receipt },
  { href: '/admin/operations', label: 'Operasi', icon: Ship },
];

function Shell({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const sections: NavSection[] =
    profile?.role === 'super_admin'
      ? [
          { label: 'Operasi', items: COMMON },
          { label: 'Tetapan', items: SUPER },
        ]
      : [{ label: 'Operasi', items: COMMON }];
  const items = [...COMMON, ...SUPER.filter(() => profile?.role === 'super_admin')];
  return (
    <AppShell sections={sections} items={items} tabs={TABS} moreTab home="/admin">
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
