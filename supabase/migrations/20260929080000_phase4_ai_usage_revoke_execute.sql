-- Phase 4 security fix: check_and_increment_ai_usage is SECURITY DEFINER and takes
-- p_user_id, so if anon/authenticated can EXECUTE it directly they could bump another
-- user's daily counter and lock them out (cross-user quota DoS). Lock execution to the
-- service role only (the edge functions call it via the service-role client).
revoke execute on function check_and_increment_ai_usage(uuid, int) from public, anon, authenticated;
grant execute on function check_and_increment_ai_usage(uuid, int) to service_role;
