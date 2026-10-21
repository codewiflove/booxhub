'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, LogOut, type LucideIcon } from 'lucide-react';
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

export interface NavSection {
  label: string;
  items: NavItem[];
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
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'group flex min-h-[36px] items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-white text-ocean-900 shadow-stripe-card'
                : 'text-surface-muted hover:bg-white/60 hover:text-ocean-950'
            )}
          >
            <item.icon
              className={cn(
                'h-4 w-4 shrink-0 transition-colors',
                active ? 'text-ocean-600' : 'text-surface-muted group-hover:text-ocean-700'
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  sections,
  flatItems,
  home,
  onNavigate,
}: {
  sections: NavSection[];
  flatItems: NavItem[];
  home: string;
  onNavigate?: () => void;
}) {
  const { profile, signOut } = useAuth();
  return (
    <div className="flex h-full flex-col border-r border-surface-border bg-surface">
      <div className="flex h-14 shrink-0 items-center border-b border-surface-border px-4">
        <Logo href={home} />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4 scrollbar-none">
        {sections.length > 1 ? (
          <div className="space-y-5">
            {sections.map((section) => (
              <div key={section.label}>
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-muted/70">
                  {section.label}
                </p>
                <NavList items={section.items} onNavigate={onNavigate} />
              </div>
            ))}
          </div>
        ) : (
          <NavList items={flatItems} onNavigate={onNavigate} />
        )}
      </div>
      {profile && (
        <div className="shrink-0 border-t border-surface-border p-3">
          <div className="flex items-center gap-3 rounded-md bg-white px-3 py-2.5 shadow-stripe-card">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ocean-100 text-xs font-semibold text-ocean-700">
              {initials(profile.company_name || profile.full_name || '?')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ocean-950">{profile.company_name || profile.full_name}</p>
              <p className="truncate text-xs text-surface-muted">{ROLE_LABEL[profile.role]}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-surface-muted transition-colors hover:bg-surface hover:text-ocean-700"
              aria-label="Log keluar"
            >
              <LogOut className="h-4 w-4" />
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
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-surface-border bg-white/95 pb-safe shadow-dock backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const active = isActive(pathname, tab);
          if (tab.primary) {
            return (
              <Link key={tab.href} href={tab.href} className="tap flex flex-col items-center justify-end pb-2 pt-1">
                <span
                  className={cn(
                    '-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-ocean-600 text-white shadow-stripe-hover ring-4 ring-white transition-transform',
                    active && 'scale-105'
                  )}
                >
                  <tab.icon className="h-6 w-6" />
                </span>
                <span className={cn('mt-1 text-[11px] font-semibold', active ? 'text-ocean-700' : 'text-surface-muted')}>
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
                  active ? 'bg-ocean-100 text-ocean-700' : 'text-surface-muted'
                )}
              >
                <tab.icon className={cn('h-5 w-5', active && 'stroke-[2.4]')} />
              </span>
              <span className={cn('text-[11px] font-semibold', active ? 'text-ocean-700' : 'text-surface-muted')}>
                {tab.label}
              </span>
            </Link>
          );
        })}
        {onMore && (
          <button onClick={onMore} className="tap flex min-h-[60px] flex-col items-center justify-center gap-0.5 py-2">
            <span className="flex h-8 w-14 items-center justify-center rounded-full text-surface-muted">
              <span className="h-5 w-5">⋯</span>
            </span>
            <span className="text-[11px] font-semibold text-surface-muted">Lagi</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export function AppShell({
  sections,
  items,
  tabs,
  moreTab,
  home,
  children,
}: {
  sections?: NavSection[];
  items: NavItem[];
  tabs: TabItem[];
  moreTab?: boolean;
  home: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { profile } = useAuth();
  const navSections = sections ?? [{ label: 'Menu', items }];
  return (
    <div className="min-h-screen bg-background">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 lg:block">
        <SidebarBody sections={navSections} flatItems={items} home={home} />
      </aside>
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-surface-border bg-background/85 px-4 backdrop-blur-xl lg:hidden">
        <Logo href={home} />
        <button
          onClick={() => setOpen(true)}
          aria-label="Buka menu akaun"
          className="tap flex h-9 w-9 items-center justify-center rounded-full bg-ocean-100 text-xs font-semibold text-ocean-700"
        >
          {initials(profile?.company_name || profile?.full_name || '?')}
        </button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-xs border-0 border-r border-surface-border p-0">
          <SidebarBody sections={navSections} flatItems={items} home={home} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <main className="pb-[calc(88px+env(safe-area-inset-bottom))] lg:pb-0 lg:pl-60 print:p-0">
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
  breadcrumb,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: string;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {breadcrumb && <div className="mb-2 text-xs text-surface-muted">{breadcrumb}</div>}
        {back && (
          <Link
            href={back}
            className="tap -ml-1 mb-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-surface-muted transition-colors hover:bg-surface hover:text-ocean-700"
          >
            <ChevronLeft className="h-4 w-4" /> Kembali
          </Link>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-ocean-950">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-surface-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
