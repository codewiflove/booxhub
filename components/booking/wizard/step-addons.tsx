'use client';

import { Car, Ship, Waves } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatRM } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AddonKey, AddonRate, VanType } from '@/lib/types';
import { Stepper } from './stepper';
import type { WizardState } from './wizard-model';

function Card({ icon: Icon, title, subtitle, active, children }: {
  icon: typeof Ship; title: string; subtitle: string; active: boolean; children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-2xl border bg-card p-5 transition-all duration-300', active && 'border-ocean-400 bg-ocean-50/30 shadow-sm')}>
      <div className="flex items-start gap-4">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors', active ? 'bg-ocean-700 text-white' : 'bg-ocean-50 text-ocean-700')}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ocean-950">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function StepAddons({ state, update, addons }: {
  state: WizardState; update: (patch: Partial<WizardState>) => void; addons: AddonRate[];
}) {
  const get = (k: AddonKey) => addons.find((a) => a.key === k);
  const boat = get('boat_return');
  const vanOne = get('van_one_way');
  const vanRet = get('van_return');
  const sn = get('snorkeling');
  const priceLine = (a?: AddonRate) => (a ? `${formatRM(a.price_adult)} dewasa / ${formatRM(a.price_child)} kanak-kanak` : '');

  const vanOptions: { v: VanType; label: string; rate?: AddonRate }[] = [
    { v: 'none', label: 'Tidak perlu' },
    { v: 'one_way', label: 'Sehala', rate: vanOne },
    { v: 'return', label: 'Dua hala', rate: vanRet },
  ];

  return (
    <div className="space-y-4">
      <Card icon={Ship} title={boat?.name ?? 'Speedboat'} subtitle={`${boat?.description ?? ''} · ${priceLine(boat)}`} active={state.includeBoat}>
        <label className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Untuk semua {state.adults + state.children} tetamu</span>
          <Switch checked={state.includeBoat} onCheckedChange={(v) => update({ includeBoat: v })} />
        </label>
      </Card>

      <Card icon={Car} title="Van Lapangan Terbang KBR" subtitle="Sultan Ismail Petra Airport <-> Jeti Kuala Besut" active={state.vanType !== 'none'}>
        <div className="grid gap-2 sm:grid-cols-3">
          {vanOptions.map((o) => (
            <button key={o.v} type="button" onClick={() => update({ vanType: o.v })}
              className={cn('rounded-xl border p-3 text-left text-sm transition-colors',
                state.vanType === o.v ? 'border-ocean-500 bg-white ring-1 ring-ocean-500' : 'hover:bg-muted/50')}>
              <p className="font-semibold text-ocean-950">{o.label}</p>
              {o.rate && <p className="mt-0.5 text-xs text-muted-foreground">{formatRM(o.rate.price_adult)} / {formatRM(o.rate.price_child)}</p>}
            </button>
          ))}
        </div>
        {state.vanType !== 'none' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="flight">No. penerbangan</Label>
              <Input id="flight" value={state.flightNumber} maxLength={20} placeholder="Contoh: AK6292"
                onChange={(e) => update({ flightNumber: e.target.value.toUpperCase() })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ftime">Masa ketibaan</Label>
              <Input id="ftime" type="time" value={state.flightArrivalTime}
                onChange={(e) => update({ flightArrivalTime: e.target.value })} />
            </div>
          </div>
        )}
      </Card>

      <Card icon={Waves} title={sn?.name ?? 'Snorkeling'} subtitle={`${sn?.description ?? ''} · ${priceLine(sn)}`} active={state.snorkelAdult + state.snorkelChild > 0}>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Dewasa</span>
            <Stepper label="snorkeling dewasa" value={state.snorkelAdult} max={state.adults} onChange={(v) => update({ snorkelAdult: v })} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Kanak-kanak</span>
            <Stepper label="snorkeling kanak-kanak" value={state.snorkelChild} max={state.children} onChange={(v) => update({ snorkelChild: v })} />
          </div>
        </div>
      </Card>
    </div>
  );
}
