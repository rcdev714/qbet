begin;

-- Activate the full legal/compliance policy pack displayed by lib/legal/policy-content.ts.
-- Hashes are SHA-256 values of the rendered in-app policy document payloads.

update public.policy_versions
set retired_at = now()
where jurisdiction in ('US', 'EC')
  and kind in (
    'terms',
    'privacy',
    'risk_disclosure',
    'market_rules',
    'aml_kyc',
    'prohibited_markets'
  )
  and is_required is true
  and retired_at is null
  and version <> '2026-06-22-legal-framework';

insert into public.policy_versions(kind, version, title, url, content_hash, is_required, effective_at, jurisdiction)
values
  ('terms', '2026-06-22-legal-framework', 'Terms of Service', '/terms', '4856d7049ae7e4f729d1c68ad35c924c1a0bb4bdfebc314cc2657fe00a0eaaba', true, now(), 'US'),
  ('privacy', '2026-06-22-legal-framework', 'Privacy Policy', '/privacy', '657e5025d1582a55c3e067e3f2a88df4b320ccbe53f839bea30b4bb716a98382', true, now(), 'US'),
  ('risk_disclosure', '2026-06-22-legal-framework', 'Real-Money Market Risk Disclosure', '/risk', 'de2503f432ad39375a9bba9245b96229ba881d8c9a6c8b43edbe7b4af053d72e', true, now(), 'US'),
  ('market_rules', '2026-06-22-legal-framework', 'Market Creation and Resolution Rules', '/market-rules', 'b18f66e842b761e04087b8d1b77955f4da83e163488ed05bf9a036ab00e2f438', true, now(), 'US'),
  ('aml_kyc', '2026-06-22-legal-framework', 'AML and KYC Policy', '/aml-kyc', '9a12c1b3ea05ae92a6285092a8d9ee59f6a67866a51ec799e2ccd292571e55c3', true, now(), 'US'),
  ('prohibited_markets', '2026-06-22-legal-framework', 'Prohibited Markets Policy', '/prohibited-markets', '5136271feeee4cf75494d103782d561d72fdf8de62ce517254a73573a0df6894', true, now(), 'US'),
  ('terms', '2026-06-22-legal-framework', 'Terms of Service', '/terms', '981b6fcff1998b5797687521c7799dbae135dca9b37e3b74934cc9504dea203d', true, now(), 'EC'),
  ('privacy', '2026-06-22-legal-framework', 'Privacy Policy', '/privacy', 'aee3bf751e6317a41a694a653b9fcf1f3eb9853235b0c54f49128a170712abf0', true, now(), 'EC'),
  ('risk_disclosure', '2026-06-22-legal-framework', 'Real-Money Market Risk Disclosure', '/risk', '169d835e3b1ca22b1198d7ab2dcad69f2f18a1e760d70ba3ab95ba3cb2363dff', true, now(), 'EC'),
  ('market_rules', '2026-06-22-legal-framework', 'Market Creation and Resolution Rules', '/market-rules', 'adb84e8d3d2ed7b2c2d9c615d38951fe38888701c9ea5b4e7f17de6ba2f4218f', true, now(), 'EC'),
  ('aml_kyc', '2026-06-22-legal-framework', 'AML and KYC Policy', '/aml-kyc', 'bcfc570c1c80e7c5ae485ed75f24a71b89ce3f85f2da785c39551fb7b6794e55', true, now(), 'EC'),
  ('prohibited_markets', '2026-06-22-legal-framework', 'Prohibited Markets Policy', '/prohibited-markets', '97bba0a3f186033472b69cf47b0ed3deffc3b52cbb65b355e053c392532ad245', true, now(), 'EC')
on conflict (kind, version, jurisdiction) do update
  set title = excluded.title,
      url = excluded.url,
      content_hash = excluded.content_hash,
      is_required = excluded.is_required,
      effective_at = excluded.effective_at,
      retired_at = null;

commit;
