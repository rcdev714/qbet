# EC Real-Money Web Beta — E2E Test Checklist

Manual QA checklist before inviting beta users. Run against **local** (`http://localhost:8081`) or **production** (`https://anymarket.expo.app`) with Stripe test mode where applicable.

**Related:** [local-dev-verification.md](./local-dev-verification.md) · [deploy-beta-approval-notify.md](./deploy-beta-approval-notify.md) · [deploy-web-production.md](./deploy-web-production.md)

---

## Pre-flight (engineering)

- [ ] Apply migrations through `20260626120000_beta_approval_notify.sql`
- [ ] Set `EXPO_PUBLIC_LAUNCH_JURISDICTION=EC`
- [ ] Set `EXPO_PUBLIC_BETA_REQUIRED=true`
- [ ] Supabase secrets: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EXPO_PUBLIC_APP_URL=https://anymarket.expo.app` (prod)
- [ ] Edge function `send-beta-approval-email` deployed (prod)
- [ ] Resend domain `camella.app` verified (prod)
- [ ] Confirm EC-only countries: only Ecuador enabled in `supported_residence_countries`
- [ ] Run `npm run verify` (typecheck + lint + web export + unit + Deno email tests)
- [ ] Run `npm run test:beta-approval-flow` locally
- [ ] Run `npm run test:e2e:api` for bet contract API flow (optional `RUN_BET_CONTRACT_EMAIL_TEST=1`)
- [ ] Run `npm run predeploy:prod` before production deploy

### Optional direct invite (legacy path)

```sql
insert into beta_invites (email) values ('tester@example.com')
on conflict (email) do nothing;
```

---

## Beta approval email flow

- [ ] Submit at `/request-access` with test email → success banner with email shown
- [ ] Row appears in `beta_access_requests` with status `pending`
- [ ] Admin **Users** (`/admin/users`) → approve → green success banner (web uses confirm dialog)
- [ ] **Approved** tab shows request + **Approval email sent** timestamp
- [ ] Email arrives from `AnyMarket <onboarding@camella.app>` (prod) or test sender (local)
- [ ] Welcome link opens `/beta/welcome?token=...` on correct host (`anymarket.expo.app` in prod)
- [ ] Welcome page shows approved state; local intent saved (`lib/beta-access-intent`)
- [ ] **Sign up** / **Sign in** with **same email** → skips waitlist → `/onboarding/residence`
- [ ] **Resend approval email** works from admin (no duplicate-user confusion)
- [ ] Decline path: admin decline → user stays blocked; no welcome email

### Signed-in waitlist path

- [ ] User signs up before approval → `/onboarding/beta-waitlist`
- [ ] After admin approve → within ~30s or app focus → **Continue onboarding**

---

## Landing and access

- [ ] `/` shows **Request access** as primary CTA (links to `/request-access`)
- [ ] WhatsApp contact appears as secondary link on landing
- [ ] **Log in** appears in top-right nav only
- [ ] Footer shows WhatsApp contact and legal policy links
- [ ] `/request-access` form validates email + Ecuador residence selection

---

## Onboarding

- [ ] Signup with invited email (`beta_invites`) → not blocked by waitlist
- [ ] Signup with approved request email → not blocked by waitlist
- [ ] Signup with non-invited, non-approved email → `/onboarding/beta-waitlist`
- [ ] Beta waitlist shows WhatsApp contact link
- [ ] Residence screen shows Ecuador only (when `EXPO_PUBLIC_LAUNCH_JURISDICTION=EC`)
- [ ] Policies: 17+ checkbox required; all policy links visible; acceptance required
- [ ] `user_compliance_profiles.age_attested_at` set after policies

---

## Spanish UI auto-switch (i18n)

- [ ] Select Ecuador on residence onboarding → UI switches to Spanish before submit
- [ ] After residence lock, app stays in Spanish (`primary_ui_locale = es`)
- [ ] US-framework Spanish-speaking country (e.g. MX if enabled) → Spanish UI + US Spanish policy pack
- [ ] English-speaking country (e.g. US) → English UI + English policies
- [ ] Policy consent and prohibited-markets copy render in Spanish for `es` locale
- [ ] `og:locale` meta reflects `es_ES` or `en_US` on market and onboarding pages

---

## Practice mode

- [ ] Default mode is Practice
- [ ] Practice bet succeeds (local balance)
- [ ] Live toggle prompts identity verification

---

## KYC + live wallet

- [ ] `/wallet/verify` starts Stripe Identity session
- [ ] Return URL completes polling; `kyc_status = verified`, `live_wallet_enabled = true`
- [ ] Live mode enabled after verification
- [ ] Deposit (Stripe test) credits wallet
- [ ] Live bet passes `assert_compliance_gate`
- [ ] Withdrawal flow reaches Stripe (test mode)

---

## Compliance gates (should deny)

- [ ] User without policy acceptances cannot place live bet
- [ ] User without KYC cannot deposit/withdraw
- [ ] Sports **category** live bet denied for EC user (`ec_sports_market_blocked` in `compliance_events`)
- [ ] Sports **category** market creation denied for EC creator
- [ ] EC user creates group market with sports text → client pre-check blocks; server rejects with `ec_sports_content_detected`
- [ ] EC user opens direct link to sports-text market → blocked banner; live bet disabled
- [ ] EC user live bet on existing sports-text market → `ec_sports_content_detected` logged
- [ ] Public feed for EC user excludes sports-text markets
- [ ] Non-EC (US jurisdiction) user can still create/view sports markets unchanged

---

## UGC

- [ ] Report market chat message → row in `content_reports`
- [ ] Block user from profile → row in `user_blocks`
- [ ] Admin dashboard lists open reports; resolve works

---

## Monitoring

- [ ] `compliance_events` logs gate decisions for deposit, live bet, withdrawal
- [ ] Run `prepare_regulatory_report_period` for EC smoke test
- [ ] Ledger export returns rows after test transactions

---

## Production deploy verification

After `git push master` or `npm run deploy:web:prod`:

- [ ] https://anymarket.expo.app/request-access returns 200
- [ ] https://anymarket.expo.app/beta/welcome returns 200 (without token shows error state, not 404)
- [ ] https://anymarket.expo.app/admin/users returns 200 (auth required for data)
- [ ] EAS workflow run succeeded (`npx eas workflow:runs --limit 3`)
- [ ] No unintended iOS/Android builds triggered on push

---

## Counsel gate (before public launch)

- [ ] EC classification memo signed ([ec-product-classification-memo.md](./ec-product-classification-memo.md))
- [ ] Spanish policies counsel-approved (`lib/legal/policy-content-es-ec.ts`)
- [ ] US framework Spanish policies counsel-approved (`lib/legal/policy-content-es-us.ts`)
- [ ] UAFE/AML runbook signed off ([ec-uafe-sri-compliance-runbook.md](./ec-uafe-sri-compliance-runbook.md))
- [ ] Local entity determination ([ec-local-presence-requirements.md](./ec-local-presence-requirements.md))

See [ec-counsel-launch-checklist.md](./ec-counsel-launch-checklist.md) for full counsel track.
