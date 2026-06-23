begin;

-- Update link-enriched legal/compliance policy pack with verified official reference URLs.
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
  and version <> '2026-06-22-legal-references';

insert into public.policy_versions(kind, version, title, url, content_hash, is_required, effective_at, jurisdiction)
values
  ('terms', '2026-06-22-legal-references', 'Terms of Service', '/terms', '8b1223f95e9bdf3f5a84fd8e466d9ff5e639d0d2fa0116f80cca419589009a1c', true, now(), 'US'),
  ('privacy', '2026-06-22-legal-references', 'Privacy Policy', '/privacy', 'da0fe23023f1549c3b6879dcb6b00aaee51f078ef4ba4649cc74b6e81f165844', true, now(), 'US'),
  ('risk_disclosure', '2026-06-22-legal-references', 'Real-Money Market Risk Disclosure', '/risk', 'b4b23063108b2042ba7229e5e6103394abab46573a4886550dcc6ba876967195', true, now(), 'US'),
  ('market_rules', '2026-06-22-legal-references', 'Market Creation and Resolution Rules', '/market-rules', 'ccb29429f055495b7a5ef900fd1272c680ccedfaf2ec6661d21281d786889d05', true, now(), 'US'),
  ('aml_kyc', '2026-06-22-legal-references', 'AML and KYC Policy', '/aml-kyc', '6d25f4db4c0a51f24ba4a0677f4c7b14ceb462b50518a6e0a26e01817830df8f', true, now(), 'US'),
  ('prohibited_markets', '2026-06-22-legal-references', 'Prohibited Markets Policy', '/prohibited-markets', '87f9f744cf1989b9b55b7580e84552f43bac389ff14cbf0fe3cead1df4652777', true, now(), 'US'),
  ('terms', '2026-06-22-legal-references', 'Terms of Service', '/terms', '295e8020af2d2bc8804540ffb5304f50bef703b44f4b5bc7c9f0816b17f8eb82', true, now(), 'EC'),
  ('privacy', '2026-06-22-legal-references', 'Privacy Policy', '/privacy', '6763dd8a74324a7511925cb944cf809fc8b805976560285285dab82f439addf1', true, now(), 'EC'),
  ('risk_disclosure', '2026-06-22-legal-references', 'Real-Money Market Risk Disclosure', '/risk', '8520a0fb66b35f11a297bb0fba3b69339c1349f4262baa14d89237a9f3549e79', true, now(), 'EC'),
  ('market_rules', '2026-06-22-legal-references', 'Market Creation and Resolution Rules', '/market-rules', 'd569d4dcf9dfc029b1b314f17f9375e2f38e25c8e70dccc35e9975241d3477db', true, now(), 'EC'),
  ('aml_kyc', '2026-06-22-legal-references', 'AML and KYC Policy', '/aml-kyc', '65017f90653e37052c1fc8f13bb320ad1b507c3845b3d2a8a99e783b5169a3a1', true, now(), 'EC'),
  ('prohibited_markets', '2026-06-22-legal-references', 'Prohibited Markets Policy', '/prohibited-markets', '1bdc604b36e4bfac5cdc35712fbaf0d51104365d9eefa4ee2c774a977ecc6ad7', true, now(), 'EC')
on conflict (kind, version, jurisdiction) do update
  set title = excluded.title,
      url = excluded.url,
      content_hash = excluded.content_hash,
      is_required = excluded.is_required,
      effective_at = excluded.effective_at,
      retired_at = null;

commit;
