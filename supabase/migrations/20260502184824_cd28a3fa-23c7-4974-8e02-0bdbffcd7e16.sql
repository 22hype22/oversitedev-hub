CREATE OR REPLACE FUNCTION public.get_total_members_serving()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(latest.member_count), 0)::bigint
  FROM (
    SELECT DISTINCT ON (bot_id) bot_id, member_count
    FROM public.bot_usage_metrics
    ORDER BY bot_id, bucket_start DESC
  ) latest;
$$;

GRANT EXECUTE ON FUNCTION public.get_total_members_serving() TO anon, authenticated;