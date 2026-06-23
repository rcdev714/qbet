# EC Real-Money Web Beta — E2E Test Checklist

Run against local or staging with Stripe test mode before inviting beta users.

## Setup

- [ ] Apply migrations through `20260626120000_beta_approval_notify.sql`
- [ ] Set `EXPO_PUBLIC_LAUNCH_JURISDICTION=EC`
- [ ] Set `EXPO_PUBLIC_BETA_REQUIRED=true`
- [ ] Insert beta invite: `insert into beta_invites (email) values ('tester@example.com');`
- [ ] Confirm EC-only countries: only Ecuador enabled in `supported_residence_countries`
- [ ] Run `npm run verify` (typecheck + lint + web export + unit + Deno email tests)
- [ ] Run `npm run test:beta-approval-flow` (local submit → approve → resolve)
- [ ] Run `npm run predeploy:prod` before production deploy

## Beta approval email flow

- [ ] Submit at `/request-access` with test email
- [ ] Admin **Users** → approve → green banner + **Approved** tab shows email sent
- [ ] Welcome link opens `/beta/welcome?token=...` and saves intent
- [ ] Sign up / sign in with same email → skips waitlist → `/onboarding/residence`
- [ ] Prod welcome links use `https://anymarket.expo.app`; sender may be `@camella.app`

## Landing and access

- [ ] `/` shows WhatsApp **Request access** as primary CTA (opens wa.me link)
- [ ] **Log in** appears only in top-right nav
- [ ] Footer shows WhatsApp contact and legal policy links

## Onboarding

- [ ] Signup with invited email → not blocked by beta waitlist
- [ ] Signup with non-invited email → `/onboarding/beta-waitlist`
- [ ] Beta waitlist shows WhatsApp contact link
- [ ] Residence screen shows Ecuador only
- [ ] Policies: 17+ checkbox required; policy acceptance required
- [ ] `user_compliance_profiles.age_attested_at` set after policies

## Spanish UI auto-switch (i18n)

- [ ] Select Ecuador on residence onboarding → UI switches to Spanish before submit (tab labels, onboarding copy)
- [ ] After residence lock, app stays in Spanish (`primary_ui_locale = es` in `supported_residence_countries`)
- [ ] US-framework Spanish-speaking country (e.g. MX if enabled) → Spanish UI + US Spanish policy pack (`2026-06-24-es-us`)
- [ ] English-speaking country (e.g. US) → English UI + English policies
- [ ] Policy consent checkbox and prohibited-markets copy render in Spanish for `es` locale
- [ ] `og:locale` meta reflects `es_ES` or `en_US` on market and onboarding pages

## Practice mode

- [ ] Default mode is Practice
- [ ] Practice bet succeeds (local balance)
- [ ] Live toggle prompts identity verification

## KYC + live wallet

- [ ] `/wallet/verify` starts Stripe Identity session
- [ ] Return URL completes polling; `kyc_status = verified`, `live_wallet_enabled = true`
- [ ] Live mode enabled after verification
- [ ] Deposit (Stripe test) credits wallet
- [ ] Live bet passes `assert_compliance_gate`
- [ ] Withdrawal flow reaches Stripe (test mode)

## Compliance gates (should deny)

- [ ] User without policy acceptances cannot place live bet
- [ ] User without KYC cannot deposit/withdraw
- [ ] Sports **category** live bet denied for EC user (`ec_sports_market_blocked` in `compliance_events`)
- [ ] Sports **category** market creation denied for EC creator
- [ ] EC user creates group market with sports text (e.g. "¿Gana el Barcelona?") → client pre-check blocks submit; server sets `compliance_review_state = rejected`, `reason_code = ec_sports_content_detected`
- [ ] EC user opens direct link to sports-text market → blocked banner on market detail; live bet disabled
- [ ] EC user live bet on existing sports-text market → `ec_sports_content_detected` in `compliance_events`
- [ ] Public feed for EC user excludes sports-text markets (defense in depth after SQL filter)
- [ ] Non-EC (US jurisdiction) user can still create/view sports markets unchanged

## UGC

- [ ] Report market chat message → row in `content_reports`
- [ ] Block user from profile → row in `user_blocks`
- [ ] Admin dashboard lists open reports; resolve works

## Monitoring

- [ ] `compliance_events` logs gate decisions for deposit, live bet, withdrawal
- [ ] Run `prepare_regulatory_report_period` for EC smoke test
- [ ] Ledger export returns rows after test transactions

## Counsel gate (before public launch)

- [ ] EC classification memo signed ([`docs/ec-product-classification-memo.md`](./ec-product-classification-memo.md))
- [ ] Spanish policies counsel-approved (`lib/legal/policy-content-es-ec.ts`; hashes in `20260623140000_ec_sports_gate_and_spanish_policies.sql`)
- [ ] US framework Spanish policies counsel-approved (`lib/legal/policy-content-es-us.ts`; hashes in `20260624130000_primary_ui_locale_and_es_us_policies.sql`)
- [ ] UAFE/AML runbook signed off ([`docs/ec-uafe-sri-compliance-runbook.md`](./ec-uafe-sri-compliance-runbook.md))
- [ ] Local entity determination ([`docs/ec-local-presence-requirements.md`](./ec-local-presence-requirements.md))
