/*
# Mark demo profiles when the demo flag is attached to the login account

1. Changes
- The auth service writes `app_metadata` after the account row is first inserted, so the
  insert trigger cannot see the demo flag. A new AFTER UPDATE trigger on `auth.users`
  marks the matching profile as `is_demo = true` once the flag appears.
- Existing demo-flagged accounts are marked now.

2. Security
- Only the server (service role / admin API) can set `app_metadata`; ordinary users cannot,
  so nobody can make themselves a demo account.
- Demo profiles are excluded from the "first account becomes Super Admin" rule, so the
  first real registration still becomes Super Admin.
*/

CREATE OR REPLACE FUNCTION handle_user_demo_flag() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE((NEW.raw_app_meta_data->>'demo')::boolean, false)
     AND NOT COALESCE((OLD.raw_app_meta_data->>'demo')::boolean, false) THEN
    UPDATE profiles SET is_demo = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION handle_user_demo_flag() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_demo_flag ON auth.users;
CREATE TRIGGER on_auth_user_demo_flag AFTER UPDATE OF raw_app_meta_data ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_user_demo_flag();

UPDATE profiles p SET is_demo = true
FROM auth.users u
WHERE u.id = p.id AND COALESCE((u.raw_app_meta_data->>'demo')::boolean, false) AND NOT p.is_demo;
