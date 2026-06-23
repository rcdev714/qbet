begin;

select plan(8);

select has_column(
  'public',
  'beta_access_requests',
  'approval_token',
  'approval_token column exists'
);

select has_column(
  'public',
  'beta_access_requests',
  'approval_email_sent_at',
  'approval_email_sent_at column exists'
);

select has_function(
  'public',
  'resolve_beta_approval_token',
  array['uuid'],
  'resolve_beta_approval_token RPC exists'
);

select has_function(
  'public',
  'mark_beta_approval_email_sent',
  array['uuid'],
  'mark_beta_approval_email_sent RPC exists'
);

select has_function(
  'public',
  'approve_beta_access_request',
  array['uuid', 'text'],
  'approve_beta_access_request RPC exists'
);

select is(
  has_function_privilege(
    'anon',
    'public.resolve_beta_approval_token(uuid)',
    'EXECUTE'
  ),
  true,
  'anon can execute resolve_beta_approval_token'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.resolve_beta_approval_token(uuid)',
    'EXECUTE'
  ),
  true,
  'authenticated can execute resolve_beta_approval_token'
);

select isnt(
  has_function_privilege(
    'authenticated',
    'public.mark_beta_approval_email_sent(uuid)',
    'EXECUTE'
  ),
  true,
  'authenticated cannot execute mark_beta_approval_email_sent'
);

select * from finish();

rollback;
