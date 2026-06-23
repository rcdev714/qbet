begin;

-- Primary UI locale for Spanish auto-switch by residence country
alter table public.supported_residence_countries
  add column if not exists primary_ui_locale text not null default 'en'
  check (primary_ui_locale in ('en', 'es'));

update public.supported_residence_countries
set primary_ui_locale = 'es'
where country_code in ('EC', 'MX', 'CO', 'PE', 'CL', 'AR', 'ES');

-- US framework Spanish policy pack (Spanish-speaking countries on US compliance framework)
insert into public.policy_versions(kind, version, title, url, content_hash, is_required, effective_at, jurisdiction)
values
  ('terms', '2026-06-24-es-us', 'Términos de Servicio', '/terms', '4efecea6045dfa90e7027d67bd7f1ec15199b30c5f6deb4e2e0084ca15da82d1', true, now(), 'US'),
  ('privacy', '2026-06-24-es-us', 'Política de Privacidad', '/privacy', 'a4d8084fddf9ce431caa024f0271a706c1d2c3c943584211d1482dc5972da9e8', true, now(), 'US'),
  ('risk_disclosure', '2026-06-24-es-us', 'Divulgación de Riesgos', '/risk', '7862aaf647e6df56265bf1004f4881e3dda2257af2cabfd4d9f6f83bd5a69403', true, now(), 'US'),
  ('market_rules', '2026-06-24-es-us', 'Reglas de Mercados', '/market-rules', 'f294a72551cbb8fe898e59e199b30b24d40a83b3c250e1db76ae2ffba2a57e0c', true, now(), 'US'),
  ('aml_kyc', '2026-06-24-es-us', 'Política AML y KYC', '/aml-kyc', '6bbf00cfa7f9a1b1212181f8fe29b24d10961ede5622ce2ff60f8dbd2a0c085e', true, now(), 'US'),
  ('prohibited_markets', '2026-06-24-es-us', 'Mercados Prohibidos', '/prohibited-markets', 'a6887f1e8cccd0e1353fe111bcd3f713410a197d214bc1699d90cc6d8013a229', true, now(), 'US')
on conflict (kind, version, jurisdiction) do update
  set title = excluded.title,
      url = excluded.url,
      content_hash = excluded.content_hash,
      is_required = excluded.is_required,
      effective_at = excluded.effective_at,
      retired_at = null;

-- Refresh EC Spanish prohibited markets hash after automated detection copy update
update public.policy_versions
set content_hash = 'df8af619a3f7ce4f6c2b5e0e114b763b1fe0487cd2bf1e688e3a7e5fba384240'
where kind = 'prohibited_markets'
  and version = '2026-06-22-es-ec'
  and jurisdiction = 'EC';

commit;
