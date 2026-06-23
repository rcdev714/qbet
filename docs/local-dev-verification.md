# Local development and verification

Use this checklist before beta invites, production deploys, or counsel demos.

**See also:** [docs/README.md](./README.md) (index) · [deploy-beta-approval-notify.md](./deploy-beta-approval-notify.md) · [deploy-web-production.md](./deploy-web-production.md)

---

## Prerequisites

| Tool | Version / notes |
|------|-----------------|
| Node.js | 20+ |
| Docker | For local Supabase |
| Supabase CLI | `npx supabase` |
| Deno | Optional; required for `npm run test:beta-approval-email` |
| psql | Optional; SQL smoke tests |

---

## Environment variables

### App (`.env`)

Copy from [`.env.example`](../.env.example). These are **client-safe** (`EXPO_PUBLIC_*`) and embedded in the web bundle.

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=<publishable key from `npx supabase status`>
EXPO_PUBLIC_APP_URL=http://localhost:8081
EXPO_PUBLIC_LAUNCH_JURISDICTION=EC
EXPO_PUBLIC_BETA_REQUIRED=true
EXPO_PUBLIC_ADMIN_EMAIL=you@example.com
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
# Set true to show verbose contract-pipeline logs and the BetContractScreen debug panel
EXPO_PUBLIC_DEBUG_LOGS=true
```

Restart `npm run web` after changing `.env`.

### Edge functions (`supabase/functions/.env`)

Copy from [`supabase/functions/.env.example`](../supabase/functions/.env.example). **Gitignored.** Used by `supabase functions serve`.

```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=AnyMarket <onboarding@camella.app>
EXPO_PUBLIC_APP_URL=http://localhost:8081
```

| Tip | Detail |
|-----|--------|
| Local welcome links in email | Keep `EXPO_PUBLIC_APP_URL=http://localhost:8081` |
| Real recipients during local dev | Set `EXPO_PUBLIC_APP_URL=https://anymarket.expo.app` so email links open prod/staging web |
| Resend test mode | Use `delivered@resend.dev` as recipient when domain unverified |

Supabase auto-injects into functions (do not set manually): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Optional (`.env.local`)

Server-only secrets for share routes and Stripe webhooks — see `.env.example` comments. **Never commit.**

### WhatsApp contact

Not env-configurable — see [`lib/contact.ts`](../lib/contact.ts).

---

## Start Supabase locally

```bash
npx supabase start
npx supabase migration up --local
npx supabase status
```

| Service | URL |
|---------|-----|
| API | http://127.0.0.1:54321 |
| Studio | http://127.0.0.1:54323 |
| Mailpit (auth email) | http://127.0.0.1:54324 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### Seed data

**Beta invite (direct allowlist):**

```sql
insert into public.beta_invites (email)
values ('your-test@example.com')
on conflict (email) do nothing;
```

**Admin user:** sign up locally, then in Studio:

```sql
update public.users set is_admin = true where email = 'you@example.com';
```

**Local admin password:** E2E tests reset the admin auth password before each run. If login fails with 400, reset it:

```bash
bash scripts/reset-local-admin-password.sh
# default: E2eAdmin!Test1 — override with LOCAL_ADMIN_PASSWORD=YourPass bash scripts/reset-local-admin-password.sh
```

Or use [`supabase/scripts/grant_app_admin.sql`](../supabase/scripts/grant_app_admin.sql) on hosted projects.

---

## Run the app

```bash
npm install
npm run web
```

Open http://localhost:8081

### Serve edge functions (beta approval email)

Required for real Resend sends when approving locally:

```bash
npx supabase functions serve send-beta-approval-email --env-file supabase/functions/.env
```

Endpoint: `http://127.0.0.1:54321/functions/v1/send-beta-approval-email`

---

## Health checks and tests

### npm scripts

| Command | Description |
|---------|-------------|
| `npm run health` | Full local gate: typecheck, lint, unit tests, Deno email tests, policy hashes, hooks order, SQL smoke + beta env check (when Supabase up) |
| `npm run verify` | `check:web:prod` + unit tests + Deno email tests |
| `npm run predeploy:prod` | `verify` + Supabase secrets/function/migration/Resend domain checks |
| `npm run test` | All Node unit tests (`lib/**/*.test.ts`, `services/**/*.test.ts`) |
| `npm run test:beta-approval-email` | Deno tests for email HTML/URL helpers |
| `npm run test:beta-approval-sql` | SQL smoke (columns, RPCs, migrations) |
| `npm run test:beta-approval-flow` | Integration: submit → approve → resolve |
| `npm run test:e2e:env` | Full-stack E2E environment check |
| `npm run test:e2e:api` | Backend E2E (beta + bet contract API flows) |
| `npm run test:e2e` | Full local E2E (orchestrator + Playwright) |
| `npm run test:e2e:ui` | Playwright only (services must be running) |
| `npm run check-beta-approval-local-env` | `./scripts/check-beta-approval-local-env.sh` |

**Optional Resend in flow test:**

```bash
RUN_BETA_EMAIL_TEST=1 npm run test:beta-approval-flow
```

**Expected:** 23+ unit tests pass, web export succeeds to `dist/`, no type errors.

### SQL regression tests

Located in [`supabase/tests/`](../supabase/tests/):

| File | Covers |
|------|--------|
| `beta_approval_notify.sql` | Approval columns, RPCs, privileges |
| `payment_flow_hardening.sql` | Wallet top-up/refund RPCs |

```bash
npm run test:beta-approval-sql
```

With pgTap installed, runs full pgTap suite; otherwise basic column/function checks.

---

## Auth and onboarding flow (EC beta)

| Step | Route | Expected |
|------|-------|----------|
| Landing | `/` | **Request access** primary CTA; WhatsApp secondary; **Log in** in nav |
| Request access | `/request-access` | Form → `beta_access_requests`; success banner with email |
| Welcome (email) | `/beta/welcome?token=...` | Approved screen; intent saved; signup/sign-in CTAs |
| Sign up | `/login` → Create account | Email/password or Google (web) |
| Beta gate | invited or approved email | Proceeds to residence |
| Beta gate | non-invited, pending | `/onboarding/beta-waitlist` (polls every ~30s) |
| Admin review | `/admin/users` | Approve/decline; green/red banner feedback |
| Residence | `/onboarding/residence` | Ecuador only when `EC` launch |
| Policies | `/onboarding/policies` | 17+ + all policy links visible; acceptances required |
| App | `/(tabs)` | Feed after onboarding complete |

### Admin approve on web

The admin UI uses `window.confirm()` on web (not `Alert.alert`) so approve/decline works in browsers including Cursor's embedded preview.

---

## Migrations

Apply locally: `npx supabase migration up --local`

| Version | Description |
|---------|-------------|
| `20260623120000` | EC launch beta, allowlist, age attestation, UGC |
| `20260623120001` | EC policy versions sync |
| `20260623120002` | Legal compliance policy pack |
| `20260623120003` | Legal policy references |
| `20260623140000` | EC sports gate + Spanish policies |
| `20260624120000` | EC sports content detection |
| `20260624130000` | Primary UI locale + ES-US policies |
| `20260625120000` | Beta access requests + admin RPCs |
| `20260626120000` | Approval token, email tracking, welcome RPC |

Verify applied:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20260623120000' ORDER BY version;"
```

---

## Manual test: access request form

1. `.env` points at `http://127.0.0.1:54321`
2. `npm run web` → http://localhost:8081/request-access
3. Submit with Ecuador + test email → green **Request received** banner
4. Admin → http://localhost:8081/admin/users → approve

If submit fails with missing function error: `npx supabase migration up --local`

---

## Manual test: beta approval email + welcome link

Mailpit handles **Supabase Auth** emails only. Beta approval uses **Resend** + edge function.

1. Configure `supabase/functions/.env` (see above)
2. Run `supabase functions serve send-beta-approval-email ...`
3. Submit at `/request-access` → approve in admin
4. **Approved** tab: **Approval email sent** (or **Resend approval email**)
5. Open link from email or Studio `approval_token`:

   `http://localhost:8081/beta/welcome?token=<uuid>`

6. Sign up with **same email** → skip waitlist → `/onboarding/residence`

**Waitlist user already signed in:** approve in admin; within ~30s or on app focus, waitlist shows **Continue onboarding**.

Full Resend + prod walkthrough: [deploy-beta-approval-notify.md](./deploy-beta-approval-notify.md)

---

## Manual test: wager agreement (bet contract)

Requires live mode, private group market, and migrations through `20260627150000_bet_contracts_evidence.sql`.

1. Set `EXPO_PUBLIC_DEBUG_LOGS=true` in `.env` and restart the app
2. Join or create a **private group** market (not public feed)
3. Switch to **live mode** (not practice) and place a bet from Group or Market screen
4. Confirm post-bet alert offers **View agreement** when the contract pipeline succeeds
5. Open `/contract/{betId}` — verify agreement content, email status chips, and debug panel (dev only)
6. From profile bet history, tap the contract link on the same bet
7. Resolve the market as group admin — check logs for `[marketService] resolution contract emails dispatched`
8. Re-open contract screen — **resolved** email chip should update after dispatch

Edge function logs (local): `supabase functions serve send-bet-contract-email dispatch-market-contract-emails` — look for `[send-bet-contract-email:*]` / `[dispatch-market-contract-emails:*]` request ids in the terminal.

Deploy notes: [deploy-bet-contract-email.md](./deploy-bet-contract-email.md)

Automated full-stack E2E (Playwright + Stripe test mode): [e2e-local.md](./e2e-local.md)

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Approve button does nothing (web) | Hard refresh; confirm dialog should appear (fixed vs `Alert.alert`) |
| `Could not find the function` | Run migrations |
| `RESEND_API_KEY is not configured` | Add to `supabase/functions/.env`; restart `functions serve` |
| Email failed after approve | Check Resend logs; verify `@camella.app` domain |
| Welcome link wrong host | Match `EXPO_PUBLIC_APP_URL` in functions env |
| Realtime `subscribe()` error | Use `createPostgresChannel` pattern in [`lib/supabase-realtime.ts`](../lib/supabase-realtime.ts) |

---

## Deploy web (production)

See [deploy-web-production.md](./deploy-web-production.md).

```bash
npm run predeploy:prod
npm run deploy:web:prod
# or push to master for automatic EAS workflow
```
