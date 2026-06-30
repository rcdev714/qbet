begin;

-- Requires Vault secrets (create manually per environment):
--   project_url         -> https://<project-ref>.supabase.co
--   cron_invoker_secret -> same value as CRON_INVOKER_SECRET edge function secret

create extension if not exists pg_cron with schema pg_catalog;

create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_feed_suggestions_cron()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_request_id bigint;
  v_project_url text;
  v_cron_secret text;
begin
  select decrypted_secret into v_project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into v_cron_secret
  from vault.decrypted_secrets
  where name = 'cron_invoker_secret'
  limit 1;

  if v_project_url is null or v_cron_secret is null then
    raise warning 'feed suggestions cron skipped: vault secrets not configured';
    return null;
  end if;

  select net.http_post(
    url := v_project_url || '/functions/v1/generate-feed-suggestions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_cron_secret
    ),
    body := jsonb_build_object('triggered_by', 'pg_cron'),
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.invoke_feed_suggestions_cron() from public;
grant execute on function public.invoke_feed_suggestions_cron() to postgres;

do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job where jobname = 'invoke-feed-suggestions-hourly'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end;
$$;

select cron.schedule(
  'invoke-feed-suggestions-hourly',
  '0 * * * *',
  $$ select public.invoke_feed_suggestions_cron(); $$
);

commit;
