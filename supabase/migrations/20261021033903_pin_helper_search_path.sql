/*
# Pin search_path on helper functions

1. Changes
- `my_today()` and `rate_for()` get a fixed search_path (security linter recommendation). No behaviour change.
*/
ALTER FUNCTION my_today() SET search_path = public;
ALTER FUNCTION rate_for(room_types, text) SET search_path = public;
