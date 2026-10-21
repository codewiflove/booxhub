/*
# Revoke bulk-wipe privileges from API roles

1. Security
- TRUNCATE bypasses row level security, so any signed-in user could empty a table.
- Revoke TRUNCATE, TRIGGER and REFERENCES from `anon` and `authenticated` on all portal tables.
- No data changes; normal reads/writes still governed by existing policies and RPCs.
*/

REVOKE TRUNCATE, TRIGGER, REFERENCES ON
  public.profiles, public.room_types, public.season_ranges, public.addon_rates,
  public.bookings, public.booking_rooms, public.payments, public.booking_events
FROM anon, authenticated;
