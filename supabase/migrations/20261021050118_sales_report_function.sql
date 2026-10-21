/*
# Sales & agent performance report

1. Overview
- Adds `sales_report(p_from date, p_to date)` which returns one JSON document with everything the admin
  "Laporan Jualan" dashboard needs: headline totals, monthly trend with occupancy, per-agent performance,
  per-agent monthly revenue, per-room-type performance and booking status counts.
- Sales are counted by check-in date. "Revenue" = bookings that are confirmed (deposit or fully paid).
  Expired and cancelled bookings are reported separately as lost bookings.

2. Security
- SECURITY INVOKER: the function reads through the caller's own row level security, so demo staff only
  see demo data and real staff only see real data (existing world-scoped policies).
- Raises 'Not authorized' unless the caller is approved staff (Super Admin or Ops Admin).
- EXECUTE revoked from anon/public, granted to authenticated.
- Range is capped at 3 years to keep the query bounded.
*/

CREATE OR REPLACE FUNCTION sales_report(p_from date, p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_units int;
  v_result jsonb;
BEGIN
  IF NOT is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 1100 THEN
    RAISE EXCEPTION 'Invalid range';
  END IF;

  SELECT COALESCE(SUM(total_units), 0) INTO v_units FROM room_types WHERE is_active;

  WITH bk AS (
    SELECT b.* FROM bookings b WHERE b.check_in BETWEEN p_from AND p_to
  ),
  sold AS (
    SELECT * FROM bk WHERE status IN ('CONFIRMED_PARTIAL','FULLY_PAID')
  ),
  rn AS (
    SELECT br.booking_id, SUM(br.quantity * s.nights) AS room_nights
    FROM booking_rooms br JOIN sold s ON s.id = br.booking_id GROUP BY br.booking_id
  ),
  months AS (
    SELECT m::date AS m,
      (LEAST((m + interval '1 month')::date - 1, p_to) - GREATEST(m::date, p_from) + 1) AS days
    FROM generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') m
  )
  SELECT jsonb_build_object(
    'total_units', v_units,
    'totals', (SELECT jsonb_build_object(
        'revenue', COALESCE(SUM(s.grand_total), 0),
        'collected', COALESCE(SUM(s.paid_amount), 0),
        'outstanding', COALESCE(SUM(s.grand_total - s.paid_amount), 0),
        'bookings', COUNT(*),
        'room_nights', COALESCE(SUM(rn.room_nights), 0),
        'guests', COALESCE(SUM(s.adults + s.children), 0),
        'active_agents', COUNT(DISTINCT s.agent_id),
        'room_revenue', COALESCE(SUM(s.room_total), 0),
        'boat_revenue', COALESCE(SUM(s.boat_total), 0),
        'van_revenue', COALESCE(SUM(s.van_total), 0),
        'snorkel_revenue', COALESCE(SUM(s.snorkel_total), 0),
        'lost_bookings', (SELECT COUNT(*) FROM bk WHERE status IN ('EXPIRED','CANCELLED')),
        'lost_value', (SELECT COALESCE(SUM(grand_total), 0) FROM bk WHERE status IN ('EXPIRED','CANCELLED')))
      FROM sold s LEFT JOIN rn ON rn.booking_id = s.id),
    'monthly', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'month', to_char(mo.m, 'YYYY-MM'),
        'revenue', COALESCE(x.revenue, 0),
        'collected', COALESCE(x.collected, 0),
        'bookings', COALESCE(x.bookings, 0),
        'room_nights', COALESCE(x.room_nights, 0),
        'occupancy', CASE WHEN v_units * mo.days > 0
          THEN round(100.0 * COALESCE(x.room_nights, 0) / (v_units * mo.days), 1) ELSE 0 END
      ) ORDER BY mo.m), '[]'::jsonb)
      FROM months mo LEFT JOIN (
        SELECT date_trunc('month', s.check_in)::date AS m, SUM(s.grand_total) AS revenue,
          SUM(s.paid_amount) AS collected, COUNT(*) AS bookings, SUM(COALESCE(rn.room_nights, 0)) AS room_nights
        FROM sold s LEFT JOIN rn ON rn.booking_id = s.id GROUP BY 1
      ) x ON x.m = mo.m),
    'agents', (SELECT COALESCE(jsonb_agg(a ORDER BY (a->>'revenue')::numeric DESC, a->>'company_name'), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
          'agent_id', p.id, 'company_name', p.company_name, 'full_name', p.full_name, 'status', p.status,
          'revenue', COALESCE(SUM(s.grand_total), 0),
          'collected', COALESCE(SUM(s.paid_amount), 0),
          'bookings', COUNT(s.id),
          'room_nights', COALESCE(SUM(rn.room_nights), 0),
          'guests', COALESCE(SUM(s.adults + s.children), 0),
          'last_check_in', MAX(s.check_in),
          'expired', (SELECT COUNT(*) FROM bk WHERE bk.agent_id = p.id AND bk.status = 'EXPIRED'),
          'cancelled', (SELECT COUNT(*) FROM bk WHERE bk.agent_id = p.id AND bk.status = 'CANCELLED')
        ) AS a
        FROM profiles p
        LEFT JOIN sold s ON s.agent_id = p.id
        LEFT JOIN rn ON rn.booking_id = s.id
        WHERE p.role = 'agent' AND (p.status = 'approved' OR s.id IS NOT NULL)
        GROUP BY p.id
      ) q),
    'agent_monthly', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'agent_id', agent_id, 'month', to_char(m, 'YYYY-MM'), 'revenue', revenue, 'bookings', bookings)), '[]'::jsonb)
      FROM (SELECT s.agent_id, date_trunc('month', s.check_in) AS m, SUM(s.grand_total) AS revenue, COUNT(*) AS bookings
            FROM sold s GROUP BY 1, 2) z),
    'rooms', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', rt.name, 'units', rt.total_units, 'room_nights', COALESCE(y.room_nights, 0), 'revenue', COALESCE(y.revenue, 0)
      ) ORDER BY COALESCE(y.revenue, 0) DESC), '[]'::jsonb)
      FROM room_types rt LEFT JOIN (
        SELECT br.room_type_id, SUM(br.quantity * s.nights) AS room_nights, SUM(br.subtotal) AS revenue
        FROM booking_rooms br JOIN sold s ON s.id = br.booking_id GROUP BY 1
      ) y ON y.room_type_id = rt.id
      WHERE rt.is_active OR y.room_type_id IS NOT NULL),
    'status', (SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb)
      FROM (SELECT status, COUNT(*) AS n FROM bk GROUP BY status) st)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION sales_report(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION sales_report(date, date) TO authenticated;
