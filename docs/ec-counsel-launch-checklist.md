# EC Real-Money Web Beta — Counsel & Ops Checklist

Engineering deliverable for the parallel counsel track. Not legal advice.

## Engineering deliverables (completed)

- [x] **Product classification memo template:** [`ec-product-classification-memo.md`](./ec-product-classification-memo.md) — counsel sign-off sections for LOPD vs non-sports classification
- [x] **UAFE / SRI runbook:** [`ec-uafe-sri-compliance-runbook.md`](./ec-uafe-sri-compliance-runbook.md) — registration checklist, SAR escalation draft, tax questions
- [x] **Local presence checklist:** [`ec-local-presence-requirements.md`](./ec-local-presence-requirements.md) — entity / domicile decision matrix
- [x] **Spanish-primary EC policy pack:** `lib/legal/policy-content-es-ec.ts` — served for all `jurisdiction=EC` routes
- [x] **Content hashes:** migration `20260623140000_ec_sports_gate_and_spanish_policies.sql` — SHA-256 for version `2026-06-22-es-ec`
- [x] **Server-side sports blocks:** `assert_compliance_gate` + `upsert_market_compliance_review` deny `ec_sports_market_blocked` for EC users

Recompute hashes after counsel edits: `npx tsx scripts/compute-policy-hashes.ts`

## Blocking before public real-money launch (counsel)

- [ ] **Product classification memo signed:** Are non-sports future-event markets outside the sports-betting licensing regime (`operador de pronósticos deportivos`)? Classification of wallet balances and user-to-user transfers.
- [ ] **Spanish policy counsel review:** Engineering Spanish pack in `policy-content-es-ec.ts` — counsel-approved final text
- [ ] **UAFE / AML:** Confirm pre-beta registration requirements, appointed compliance function, and SAR escalation workflow (see runbook)
- [ ] **Tax:** VAT/digital services, withholding, and monthly reporting obligations for EC users (see runbook)
- [ ] **LOPDP:** Data protection posture, privacy notice adequacy, DPD appointment if required
- [ ] **Stripe Ecuador:** Confirm Connect Express + Identity support for `country=EC` residence in production Stripe account
- [ ] **Local entity:** Confirm whether Ecuadorian subsidiary, branch, or representative is required (see local presence doc)

## Private beta (engineering can proceed)

Until counsel sign-off, keep `EXPO_PUBLIC_BETA_REQUIRED=true` and invite-only emails in `beta_invites`.

Admins (`users.is_admin`) and invited emails are auto-approved via `sync_beta_access_on_user()`.

## Evidence package for counsel review

Export from production/staging:

1. `policy_versions` + `user_policy_acceptances`
2. `user_compliance_profiles` + provider compliance status
3. `compliance_events` (gate decisions, KYC sessions — filter `ec_sports_market_blocked`)
4. `market_compliance_reviews` + public market list
5. `accounting_ledger_entries` sample via `prepare_regulatory_report_period`
6. Stripe Identity + Connect webhook logs
7. Completed [`ec-product-classification-memo.md`](./ec-product-classification-memo.md)

## Contact

Platform support: support@anymarket.app
