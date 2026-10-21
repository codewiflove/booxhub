'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/format';
import type { Booking } from '@/lib/types';

export function CancelBookingDialog({
  booking,
  open,
  onOpenChange,
  asAgent,
  onDone,
}: {
  booking: Booking;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asAgent: boolean;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const { error } = await supabase.rpc('cancel_booking', { p_booking: booking.id, p_reason: reason.trim() });
    setBusy(false);
    if (error) return toast.error(friendlyError(error, 'Tempahan tidak dapat dibatalkan.'));
    toast.success(asAgent ? 'Bilik telah dilepaskan.' : 'Tempahan dibatalkan.');
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{asAgent ? 'Lepaskan bilik?' : 'Batalkan tempahan?'}</DialogTitle>
          <DialogDescription>
            {asAgent
              ? 'Bilik akan dibuka semula untuk ejen lain. Melepaskan sendiri tidak dikira sebagai tamat tempoh.'
              : `Tempahan ${booking.code} akan dibatalkan dan bilik dipulangkan ke inventori.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">Sebab (pilihan)</Label>
          <Textarea id="reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Kembali</Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {asAgent ? 'Lepaskan bilik' : 'Batalkan tempahan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExtendHoldDialog({
  booking,
  open,
  onOpenChange,
  onDone,
}: {
  booking: Booking;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [hours, setHours] = useState('24');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const { error } = await supabase.rpc('extend_hold', { p_booking: booking.id, p_hours: Number(hours) });
    setBusy(false);
    if (error) return toast.error(friendlyError(error, 'Tempoh hold tidak dapat dilanjutkan.'));
    toast.success(`Hold dilanjutkan ${hours} jam.`);
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lanjutkan tempoh hold</DialogTitle>
          <DialogDescription>Kuasa pengurus. Ejen akan melihat kiraan detik baharu serta-merta.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Tambah masa</Label>
          <Select value={hours} onValueChange={setHours}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['1', '6', '12', '24', '48', '72'].map((h) => (
                <SelectItem key={h} value={h}>{h} jam</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Kembali</Button>
          <Button onClick={confirm} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Lanjutkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
