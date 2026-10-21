'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BedDouble, Calendar, FileBarChart2, Plus, Receipt, Search, Settings } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/lib/supabase';
import { BOOKING_LIST_SELECT } from '@/lib/bookings';
import { formatRM } from '@/lib/format';
import type { Booking } from '@/lib/types';

const QUICK_ACTIONS = [
  { icon: Plus, label: 'Kunci Bilik Baharu', href: '/portal/book' },
  { icon: Calendar, label: 'Lihat Tempahan Saya', href: '/portal/bookings' },
  { icon: Receipt, label: 'Bayaran & Resit', href: '/portal/bookings' },
  { icon: FileBarChart2, label: 'Laporan Jualan', href: '/portal/bookings' },
  { icon: Settings, label: 'Tetapan Agensi', href: '/portal/profile' },
];

const ADMIN_ACTIONS = [
  { icon: Receipt, label: 'Semakan Bayaran', href: '/admin/payments' },
  { icon: Calendar, label: 'Semua Tempahan', href: '/admin/bookings' },
  { icon: BedDouble, label: 'Katalog Bilik & Harga', href: '/admin/rooms' },
  { icon: FileBarChart2, label: 'Laporan Kewangan', href: '/admin/reports' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Booking[]>([]);
  const [query, setQuery] = useState('');
  const { profile } = useAuth();
  const router = useRouter();
  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'ops_admin';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    const { data } = await supabase
      .from('bookings')
      .select(BOOKING_LIST_SELECT)
      .or(`code.ilike.%${q}%,lead_guest_name.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(8);
    setResults((data ?? []) as unknown as Booking[]);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 200);
    return () => clearTimeout(t);
  }, [query, search]);

  const go = (href: string) => { setOpen(false); router.push(href); };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full max-w-md items-center justify-between gap-2 rounded-md border border-surface-border bg-surface px-3 py-1.5 text-sm text-surface-muted transition-colors hover:border-ocean-300"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="h-4 w-4" />
          <span>Cari kod PBC..., nama tetamu, atau no. resit...</span>
        </span>
        <kbd className="hidden rounded border border-surface-border bg-white px-1.5 py-0.5 font-mono text-[11px] text-surface-muted sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Cari tempahan, tetamu, atau pilih tindakan pantas..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>Tiada hasil dijumpai.</CommandEmpty>

          {results.length > 0 && (
            <CommandGroup heading="Tempahan">
              {results.map((b) => (
                <CommandItem
                  key={b.id}
                  onSelect={() => go(isAdmin ? `/admin/bookings/${b.id}` : `/portal/bookings/${b.id}`)}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-surface-muted" />
                    <span className="font-mono text-sm">{b.code}</span>
                    <span className="text-sm text-surface-muted">{b.lead_guest_name}</span>
                  </span>
                  <span className="text-sm font-medium tabular text-ocean-950">{formatRM(b.grand_total)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Tindakan Pantas">
            {(isAdmin ? ADMIN_ACTIONS : QUICK_ACTIONS).map((a) => (
              <CommandItem key={a.href} onSelect={() => go(a.href)}>
                <a.icon className="h-4 w-4 text-surface-muted" />
                <span className="text-sm">{a.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
