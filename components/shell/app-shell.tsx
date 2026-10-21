'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, LayoutGrid, LogOut, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useAuth } from '@/components/auth/auth-provider';
import { DemoBanner } from '@/components/shell/demo-banner';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export interface TabItem extends NavItem {
  primary?: boolean;
}

const ROLE_LABEL = { super_admin: 'Super Admin', ops_admin: 'Admin Operasi', agent: 'Ejen B2B' } as const;

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'group flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
              active
                ? 'bg-white text-ocean-900 shadow-soft'
                : 'text-ocean-100/75 hover:bg-white/[0.07] hover:text-white'
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                active ? 'bg-ocean-50 text-ocean-700' : 'bg-white/5 text-ocean-200 group-hover:text-white'
              )}
            >
              <item.icon className="h-4 w-4" />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({ items, home, onNavigate }: { items: NavItem[]; home: string; onNavigate?: () => void }) {
  const { profile, signOut } = useAuth();
  return (
    <div className="bg-lagoon flex h-full flex-col px-4 py-6">
      <div className="px-2">
        <Logo light href={home} />
      </div>
      <div className="mt-8 flex-1 overflow-y-auto scrollbar-none">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ocean-200/50">Menu</p>
        <NavList items={items} onNavigate={onNavigate} />
      </div>
      {profile && (
        <div className="mt-6 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sand-300 to-sand-500 text-sm font-semibold text-ocean-950">
              {initials(profile.company_name || profile.full_name || '?')}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{profile.company_name || profile.full_name}</p>
              <p className="truncate text-xs text-ocean-200/70">{profile.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="rounded-full bg-sand-300/15 px-2.5 py-0.5 text-[11px] font-semibold text-sand-200">
              {ROLE_LABEL[profile.role]}
            </span>
            <button
              onClick={() => signOut()}
              className="flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-ocean-200/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Log keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BottomTabs({ tabs, onMore }: { tabs: TabItem[]; onMore?: () => void }) {
  const pathname = usePathname();
  const count = tabs.length + (onMore ? 1 : 0);
  return (
    <nav
      aria-label="Navigasi utama"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-ocean-950/5 bg-white/95 pb-safe shadow-dock backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          if (tab.primary) {
            return (
              <Link key={tab.href} href={tab.href} className="tap flex flex-col items-center justify-end pb-2 pt-1">
                <span
                  className={cn(
                    '-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-coral-400 to-coral-600 text-white shadow-cta ring-4 ring-white transition-transform',
                    active && 'scale-105'
                  )}
                >
                  <tab.icon className="h-6 w-6" />
                </span>
                <span className={cn('mt-1 text-[11px] font-semibold', active ? 'text-coral-600' : 'text-ocean-900')}>
                  {tab.label}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="tap flex min-h-[60px] flex-col items-center justify-center gap-0.5 py-2"
            >
              <span
                className={cn(
                  'flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300',
                  active ? 'bg-ocean-100 text-ocean-800' : 'text-slate-500'
                )}
              >
                <tab.icon className={cn('h-5 w-5', active && 'stroke-[2.4]')} />
              </span>
              <span className={cn('text-[11px] font-semibold', active ? 'text-ocean-900' : 'text-slate-500')}>
                {tab.label}
              </span>
            </Link>
          );
        })}
        {onMore && (
          <button onClick={onMore} className="tap flex min-h-[60px] flex-col items-center justify-center gap-0.5 py-2">
            <span className="flex h-8 w-14 items-center justify-center rounded-full text-slate-500">
              <LayoutGrid className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-semibold text-slate-500">Lagi</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export function AppShell({
  items,
  tabs,
  moreTab,
  home,
  children,
}: {
  items: NavItem[];
  tabs: TabItem[];
  moreTab?: boolean;
  home: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 lg:block">
        <SidebarBody items={items} home={home} />
      </aside>
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ocean-950/5 bg-background/85 px-4 backdrop-blur-xl lg:hidden">
        <Logo href={home} />
        <button
          onClick={() => setOpen(true)}
          aria-label="Buka menu akaun"
          className="tap flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-ocean-700 to-ocean-900 text-xs font-semibold text-white shadow-soft"
        >
          {initials(profile?.company_name || profile?.full_name || '?')}
        </button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-xs border-0 p-0">
          <SidebarBody items={items} home={home} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-64 print:p-0">
        <DemoBanner />
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</div>
      </main>
      <BottomTabs tabs={tabs} onMore={moreTab ? () => setOpen(true) : undefined} />
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-fade-up">
        {back && (
          <Link
            href={back}
            className="tap -ml-2 mb-2 inline-flex min-h-[40px] items-center gap-1 rounded-full px-2 text-sm font-semibold text-ocean-700 hover:bg-ocean-50"
          >
            <ChevronLeft className="h-4 w-4" /> Kembali
          </Link>
        )}
        <h1 className="font-display text-[1.75rem] leading-tight text-ocean-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:mt-2 sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
