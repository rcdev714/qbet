# EC Real-Money Web Beta — Counsel & Ops Checklist

Engineering deliverable for the parallel counsel track. **Not legal advice.**

**Related:** [ecuador-compliance-framework.md](./ecuador-compliance-framework.md) · [ec-beta-e2e-checklist.md](./ec-beta-e2e-checklist.md) · [docs/README.md](./README.md)

---

## Engineering deliverables (completed)

- [x] **Product classification memo template:** [ec-product-classification-memo.md](./ec-product-classification-memo.md) — counsel sign-off for LOPD vs non-sports classification
- [x] **UAFE / SRI runbook:** [ec-uafe-sri-compliance-runbook.md](./ec-uafe-sri-compliance-runbook.md) — registration, SAR escalation, tax questions
- [x] **Local presence checklist:** [ec-local-presence-requirements.md](./ec-local-presence-requirements.md) — entity / domicile matrix
- [x] **Spanish-primary EC policy pack:** `lib/legal/policy-content-es-ec.ts` — all `jurisdiction=EC` routes
- [x] **US Spanish policy pack:** `lib/legal/policy-content-es-us.ts` — Spanish UI + US framework
- [x] **Content hashes:** migrations `20260623140000`, `20260624130000` — SHA-256 for counsel-verifiable versions
- [x] **Server-side sports blocks:** `assert_compliance_gate` + content detection deny EC sports exposure
- [x] **Beta access queue:** request form, admin approve, Resend email, welcome link — see [deploy-beta-approval-notify.md](./deploy-beta-approval-notify.md)
- [x] **Deploy safety gate:** `npm run verify`, `npm run predeploy:prod`, unit + SQL + integration tests

Recompute hashes after counsel edits:

```bash
npx tsx scripts/compute-policy-hashes.ts
```

---

## Private beta posture (current)

Engineering **can** operate private beta while counsel review continues:

| Control | Setting |
|---------|---------|
| Beta gate | `EXPO_PUBLIC_BETA_REQUIRED=true` |
| Access paths | `/request-access` → admin approve **or** `beta_invites` allowlist |
| Launch jurisdiction | `EXPO_PUBLIC_LAUNCH_JURISDICTION=EC` |
| Public web | https://anymarkt.com |
| Real money | Stripe test mode until counsel + ops sign-off |

Admins (`users.is_admin`) and invited emails auto-sync via `sync_beta_access_on_user()`.

---

## Blocking before public real-money launch (counsel)

- [ ] **Product classification memo signed:** Non-sports future-event markets outside sports-betting licensing (`operador de pronósticos deportivos`)? Wallet balance and P2P transfer classification.
- [ ] **Spanish policy counsel review:** Final text in `policy-content-es-ec.ts` and `policy-content-es-us.ts`
- [ ] **UAFE / AML:** Pre-beta registration, compliance function, SAR escalation (see runbook)
- [ ] **Tax:** VAT/digital services, withholding, monthly reporting for EC users
- [ ] **LOPDP:** Privacy notice, DPD appointment if required
- [ ] **Stripe Ecuador:** Connect Express + Identity for `country=EC` in production Stripe account
- [ ] **Local entity:** Ecuadorian subsidiary, branch, or representative (see local presence doc)
- [ ] **Beta comms:** Approval email copy and `@anymarkt.com` sender reviewed for regulatory accuracy

---

## Evidence package for counsel review

Export from production/staging:

1. `policy_versions` + `user_policy_acceptances`
2. `user_compliance_profiles` + provider compliance status
3. `compliance_events` (gate decisions, KYC — filter `ec_sports_market_blocked`, `ec_sports_content_detected`)
4. `market_compliance_reviews` + public market list
5. `accounting_ledger_entries` sample via `prepare_regulatory_report_period`
6. `beta_access_requests` audit trail (approve/decline timestamps, email sent)
7. Stripe Identity + Connect webhook logs
8. Resend send logs for approval emails (sample)
9. Completed [ec-product-classification-memo.md](./ec-product-classification-memo.md)

---

## Engineering release checklist (counsel-adjacent)

Before expanding beta beyond invite-only:

- [ ] `npm run predeploy:prod` passes
- [ ] [ec-beta-e2e-checklist.md](./ec-beta-e2e-checklist.md) completed on staging/prod
- [ ] Sports gates verified for EC users (category + content detection)
- [ ] Policy hashes match deployed migrations
- [ ] [trust-and-safety-web.md](./trust-and-safety-web.md) canonical URL aligned

---

## Contact

| Channel | Address |
|---------|---------|
| Platform support | support@anymarkt.com |
| Transactional email (beta approval) | onboarding@anymarkt.com (Resend) |
| WhatsApp (public CTA) | See `lib/contact.ts` |
