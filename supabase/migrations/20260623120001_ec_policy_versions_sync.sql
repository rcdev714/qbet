begin;

-- Sync EC policy_versions to match in-app June 22, 2026 pack (hashes remain placeholders until counsel delivery).
-- Retire May 14 EC rows so has_current_policy_acceptances tracks the active EC pack.

update public.policy_versions
set retired_at = now()
where jurisdiction = 'EC'
  and version = '2026-05-14'
  and retired_at is null;

insert into public.policy_versions(kind, version, title, url, content_hash, is_required, effective_at, jurisdiction)
values
  ('terms', '2026-06-22', 'Terms of Service', '/terms', 'pending-legal-hash-terms-2026-06-22-ec', true, now(), 'EC'),
  ('privacy', '2026-06-22', 'Privacy Policy', '/privacy', 'pending-legal-hash-privacy-2026-06-22-ec', true, now(), 'EC'),
  ('risk_disclosure', '2026-06-22', 'Real-Money Market Risk Disclosure', '/risk', 'pending-legal-hash-risk-2026-06-22-ec', true, now(), 'EC'),
  ('market_rules', '2026-06-22', 'Market Creation and Resolution Rules', '/market-rules', 'pending-legal-hash-market-rules-2026-06-22-ec', true, now(), 'EC'),
  ('aml_kyc', '2026-06-22', 'AML and KYC Policy', '/aml-kyc', 'pending-legal-hash-aml-kyc-2026-06-22-ec', true, now(), 'EC'),
  ('prohibited_markets', '2026-06-22', 'Prohibited Markets Policy', '/prohibited-markets', 'pending-legal-hash-prohibited-markets-2026-06-22-ec', true, now(), 'EC')
on conflict (kind, version, jurisdiction) do update
  set title = excluded.title,
      url = excluded.url,
      content_hash = excluded.content_hash,
      is_required = excluded.is_required,
      effective_at = excluded.effective_at,
      retired_at = null;

commit;
