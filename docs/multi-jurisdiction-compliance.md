# Multi-Jurisdiction Compliance

Anymarkt routes users through a **country of residence** → **compliance jurisdiction** → **policy pack** flow. Product mechanics (parimutuel engine, wallet model, markets) stay the same; only compliance gates, legal copy, and payment country alignment change by jurisdiction.

## Current jurisdictions

| Country of residence | Compliance jurisdiction | Notes |
|---------------------|-------------------------|-------|
| `EC` (Ecuador) | `EC` | Ecuador-specific market rules, KYC posture, legal disclosures |
| All other supported countries | `US` | Single US framework bucket for rest-of-world launch |

Residence is **locked after onboarding** because Stripe Connect accounts bind KYC and payout rails to the country supplied at account creation.

## Onboarding flow

When `EXPO_PUBLIC_BETA_REQUIRED=true` (EC private beta):

1. **Beta gate** — request access at `/request-access`, waitlist at `/onboarding/beta-waitlist`, or direct invite in `beta_invites`
2. **Approval** — admin approves at `/admin/users`; user receives email → `/beta/welcome?token=...`
3. Auth signup / login (same email as request or invite)
4. `/onboarding/residence` — select country (required), optional phone with dial prefix
5. `/onboarding/policies` — accept jurisdiction-specific policy pack
6. Main app

Without beta gate:

1. Auth signup / login
2. `/onboarding/residence` → `/onboarding/policies` → main app

Legacy users without `country_of_residence` are redirected to residence onboarding before the app.

See [deploy-beta-approval-notify.md](./deploy-beta-approval-notify.md) for the approval email pipeline.

## Key database objects

- `users.country_of_residence`, `phone_e164`, `phone_country_code`, `residence_set_at`
- `supported_residence_countries` — allowlist with dial codes and default jurisdiction mapping
- `compliance_jurisdiction_rules` — per-jurisdiction gate configuration (EC and US rows)
- `policy_versions.jurisdiction` — scopes required policies per framework
- RPCs: `set_user_residence`, `update_user_phone`, `get_user_compliance_jurisdiction`, `has_current_policy_acceptances` (jurisdiction-aware)

See migration: `supabase/migrations/20260622130000_country_jurisdiction_compliance.sql`

## Application layers

| Layer | Location | Role |
|-------|----------|------|
| Jurisdiction resolver | `lib/compliance/jurisdiction.ts` | EC vs US mapping, UI labels |
| Compliance service | `services/compliance.service.ts` | Residence, policies, acceptance |
| Legal content | `lib/legal/policy-content.ts`, `lib/legal/policy-content-es-ec.ts` | EC users receive Spanish-primary pack; US English pack |
| Onboarding UI | `app/onboarding/residence.tsx`, `app/onboarding/policies.tsx` | Capture residence, accept policies |
| Auth gate | `app/_layout.tsx` | Residence → policies → tabs |
| Settings | `ResidenceSettingsSection` | Read-only country/framework; optional phone edit |
| Stripe | Edge functions + `wallet.service.ts` | Connect / payout country from `wallets.country` |

## Adding a new country (rest-of-world → US)

1. Insert row in `supported_residence_countries` with `default_jurisdiction = 'US'` (or `'EC'` if launching Ecuador-only rules for that country).
2. No new policy rows needed if mapping to an existing jurisdiction.
3. Optionally add dial code and `sort_order` for the country picker.

## Adding a new jurisdiction (e.g. `CA`)

1. Add row to `compliance_jurisdiction_rules` with gate defaults.
2. Update `resolve_compliance_jurisdiction()` (SQL + `lib/compliance/jurisdiction.ts`) to map countries → new code.
3. Insert `policy_versions` rows for all six policy kinds with `jurisdiction = 'CA'`.
4. Add `POLICY_DOCUMENTS_BY_JURISDICTION.CA` in `lib/legal/policy-content.ts`.
5. Extend `ComplianceJurisdiction` type and UI labels.
6. Run counsel review for legal copy and `content_hash` values.

## Admin / support

- `admin_update_user_residence(p_user_id, p_country)` — rare manual correction; clears jurisdiction-scoped policy acceptances. Does **not** migrate Stripe Connect country; requires support workflow for new Connect onboarding.
- Users contact support@anymarkt.com for country changes.

## Related docs

- [Ecuador compliance framework](./ecuador-compliance-framework.md) — EC-specific deep dive
- [EC beta E2E checklist](./ec-beta-e2e-checklist.md) — QA before inviting users
- [Beta approval deploy](./deploy-beta-approval-notify.md) — Resend email + welcome link
- [Product classification memo](./ec-product-classification-memo.md) — LOPD vs non-sports counsel template
- [UAFE & SRI runbook](./ec-uafe-sri-compliance-runbook.md) — AML and tax operational checklist
- [Local presence requirements](./ec-local-presence-requirements.md) — entity / domicile checklist
- [Counsel launch checklist](./ec-counsel-launch-checklist.md) — blocking items before public launch

## Out of scope (v1)

- Geo-IP auto-detection
- Per-state US compliance
- Self-service country change
- Spanish legal translations (structure supports locale later)
