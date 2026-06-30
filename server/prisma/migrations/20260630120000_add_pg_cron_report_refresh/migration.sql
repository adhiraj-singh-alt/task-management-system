-- Schedule a pg_cron job to refresh the report materialized views every 10
-- minutes. Assumes the pg_cron extension is already installed/preloaded.
-- `cron.schedule` upserts by job name, so re-applying this migration updates the
-- existing job rather than creating a duplicate.

SELECT cron.schedule(
  'refresh-report-views',
  '*/10 * * * *',
  $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY report_task_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY report_task_status;
    REFRESH MATERIALIZED VIEW CONCURRENTLY report_task_priority;
    REFRESH MATERIALIZED VIEW CONCURRENTLY report_task_category;
    REFRESH MATERIALIZED VIEW CONCURRENTLY report_completion_daily;
  $$
);

-- ---------------------------------------------------------------------------
-- Confirmation queries (run manually; SELECT output is not shown during a
-- migration). The job is healthy once recent runs report status = 'succeeded'.
--
--   -- Is the job registered and active?
--   SELECT jobid, jobname, schedule, active FROM cron.job
--   WHERE jobname = 'refresh-report-views';
--
--   -- Did the latest runs succeed? (check after the first tick, ~10 min)
--   SELECT status, return_message, start_time, end_time
--   FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'refresh-report-views')
--   ORDER BY start_time DESC
--   LIMIT 5;
-- ---------------------------------------------------------------------------
