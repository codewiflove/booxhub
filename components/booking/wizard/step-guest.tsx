'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { WizardState } from './wizard-model';

export function StepGuest({ state, update }: { state: WizardState; update: (patch: Partial<WizardState>) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="lead">Nama ketua rombongan</Label>
          <Input id="lead" value={state.leadName} maxLength={120} className="sm:h-11" placeholder="Nama seperti dalam IC"
            onChange={(e) => update({ leadName: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="leadphone">No. telefon ketua rombongan</Label>
          <Input id="leadphone" type="tel" value={state.leadPhone} maxLength={40} className="sm:h-11" placeholder="Pilihan"
            onChange={(e) => update({ leadPhone: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Nota untuk chalet</Label>
        <Textarea id="notes" rows={4} value={state.notes} maxLength={1000}
          placeholder="Contoh: Pasangan bulan madu, mohon bilik bersebelahan, diet vegetarian"
          onChange={(e) => update({ notes: e.target.value })} />
      </div>
      <p className="text-sm text-muted-foreground">
        Harga dikira oleh sistem berdasarkan kadar bersih ejen. Jumlah akhir disahkan semasa tempahan dihantar.
      </p>
    </div>
  );
}
