begin;

-- Hourly email digest cron (uses Vault secrets: project_url, cron_invoker_secret).
-- cron_invoker_secret must match CRON_INVOKER_SECRET edge function secret.

create or replace function public.invoke_email_digest_cron()
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
    raise warning 'email digest cron skipped: vault secrets not configured';
    return null;
  end if;

  select net.http_post(
    url := v_project_url || '/functions/v1/process-email-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.invoke_email_digest_cron() from public;
grant execute on function public.invoke_email_digest_cron() to postgres;

do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job where jobname = 'invoke-email-digest-hourly'
  loop
    perform cron.unschedule(v_jobid);
  end loop;
end;
$$;

select cron.schedule(
  'invoke-email-digest-hourly',
  '0 * * * *',
  $$ select public.invoke_email_digest_cron(); $$
);

commit;
