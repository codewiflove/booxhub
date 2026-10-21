'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/components/auth/auth-provider';
import { DemoBanner } from '@/components/shell/demo-banner';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const ROLE_LABEL = { super_admin: 'Super Admin', ops_admin: 'Admin Operasi', agent: 'Ejen B2B' } as const;

function NavList({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
              active
                ? 'bg-white text-ocean-900 shadow-sm'
                : 'text-ocean-100/80 hover:bg-white/10 hover:text-white'
            )}
          >
            <item.icon className="h-4 w-4" />
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
    <div className="flex h-full flex-col bg-ocean-950 px-4 py-6">
      <div className="px-2">
        <Logo light href={home} />
      </div>
      <div className="mt-10 flex-1 overflow-y-auto">
        <NavList items={items} onNavigate={onNavigate} />
      </div>
      {profile && (
        <div className="mt-6 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <p className="truncate text-sm font-semibold text-white">{profile.company_name || profile.full_name}</p>
          <p className="truncate text-xs text-ocean-200/70">{profile.email}</p>
          <p className="mt-2 inline-block rounded-full bg-sand-300/20 px-2 py-0.5 text-[11px] font-semibold text-sand-200">
            {ROLE_LABEL[profile.role]}
          </p>
          <button
            onClick={() => signOut()}
            className="mt-4 flex w-full items-center gap-2 text-xs font-semibold text-ocean-200/80 transition-colors hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Log keluar
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ items, home, children }: { items: NavItem[]; home: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-64 lg:block">
        <SidebarBody items={items} home={home} />
      </aside>
      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo href={home} />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Buka menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 border-0 p-0">
            <SidebarBody items={items} home={home} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>
      <main className="lg:pl-64 print:pl-0">
        <DemoBanner />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-fade-up">
        <h1 className="font-display text-3xl text-ocean-950">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
