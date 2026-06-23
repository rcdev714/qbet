# Deploy walkthrough: Beta approval email flow

End-to-end guide for the beta approval notification system: database schema, Resend email, Supabase edge function, welcome link, and admin approve UX.

**Production status (June 2026):** deployed to Supabase `jweyqlcvvmdyyqgqcsjd`, web at https://anymarket.expo.app, sender domain `camella.app` verified in Resend.

**Related:** [docs/README.md](./README.md) · [local-dev-verification.md](./local-dev-verification.md) · [deploy-web-production.md](./deploy-web-production.md) · [ec-beta-e2e-checklist.md](./ec-beta-e2e-checklist.md)

---

## System overview

```mermaid
sequenceDiagram
  participant User
  participant Web as anymarket.expo.app
  participant DB as Supabase Postgres
  participant Admin
  participant Fn as send-beta-approval-email
  participant Resend

  User->>Web: POST /request-access
  Web->>DB: submit_beta_access_request RPC
  Admin->>Web: Approve in /admin/users
  Web->>DB: approve_beta_access_request RPC
  Web->>Fn: invoke (admin JWT)
  Fn->>DB: read approval_token, mark sent
  Fn->>Resend: POST /emails
  Resend->>User: approval email
  User->>Web: /beta/welcome?token=uuid
  Web->>DB: resolve_beta_welcome_token RPC
  User->>Web: Sign up (same email)
  Web->>DB: sync_beta_access_on_user
```

### Components

| Layer | Path / name | Role |
|-------|-------------|------|
| Request form | `app/request-access.tsx` | Public form → `submit_beta_access_request` |
| Admin queue | `screens/AdminUsersScreen.tsx` | Approve/decline; invokes email function |
| Welcome page | `app/beta/welcome.tsx` | Validates token; stores local intent |
| Waitlist | `app/onboarding/beta-waitlist.tsx` | Polls for approval when signed in |
| Service | `services/betaAccess.service.ts` | RPC wrappers + function invoke |
| Intent storage | `lib/beta-access-intent.ts` | AsyncStorage / localStorage for email hint |
| Email helpers | `supabase/functions/_shared/beta-approval-email.ts` | HTML, welcome URL, idempotency key |
| Edge function | `supabase/functions/send-beta-approval-email/` | Resend send; admin-only |
| Migration (queue) | `20260625120000_beta_access_requests.sql` | Table + submit/approve RPCs |
| Migration (email) | `20260626120000_beta_approval_notify.sql` | `approval_token`, email tracking, welcome RPC |

---

## What lives where

| Concern | Local / test | Production |
|--------|--------------|------------|
| Expo app (`EXPO_PUBLIC_*`) | `.env` | EAS **production** environment |
| Resend API key | `supabase/functions/.env` | `npx supabase secrets set` |
| Email “from” address | `RESEND_FROM_EMAIL` in functions env | Verified domain in Resend (`camella.app`) |
| Welcome link base URL | `EXPO_PUBLIC_APP_URL` in app `.env` **and** functions env | `https://anymarket.expo.app` in Supabase secrets |
| DB schema | `npx supabase migration up --local` | `npx supabase db push` |
| Edge function | `supabase functions serve` (optional) | `supabase functions deploy send-beta-approval-email` |

**Important:** `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are **Supabase Edge Function secrets only**. Never put them in `.env` (client bundle) or EAS.

Supabase injects automatically into deployed functions:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**No Resend webhook in v1.** The flow is send-only; delivery status is checked in the Resend dashboard, not via inbound webhook.

---

## Environment variable matrix

<a id="environment-variable-matrix"></a>

| Variable | App `.env` | EAS production | `supabase/functions/.env` | Supabase secrets | Notes |
|----------|:----------:|:--------------:|:-------------------------:|:----------------:|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | ✅ | auto | auto | Local: `http://127.0.0.1:54321` |
| `EXPO_PUBLIC_SUPABASE_KEY` | ✅ | ✅ | auto | auto | Anon / publishable key |
| `EXPO_PUBLIC_APP_URL` | ✅ | ✅ | ✅ | ✅ | **Must match** URL users open; prod: `https://anymarket.expo.app` |
| `EXPO_PUBLIC_BETA_REQUIRED` | ✅ | ✅ | ❌ | ❌ | `true` for EC private beta |
| `EXPO_PUBLIC_LAUNCH_JURISDICTION` | ✅ | ✅ | ❌ | ❌ | `EC` |
| `EXPO_PUBLIC_ADMIN_EMAIL` | ✅ | ✅ | ❌ | optional | Comma-separated admin emails |
| `RESEND_API_KEY` | ❌ never | ❌ never | ✅ | ✅ | `re_...` |
| `RESEND_FROM_EMAIL` | ❌ never | ❌ never | ✅ | ✅ | Prod: `AnyMarket <onboarding@camella.app>` |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | ✅ server routes | auto | auto | Never in client bundle |

### Production values (current)

```bash
# Supabase secrets (project jweyqlcvvmdyyqgqcsjd)
npx supabase secrets set RESEND_API_KEY=re_...
npx supabase secrets set RESEND_FROM_EMAIL="AnyMarket <onboarding@camella.app>"
npx supabase secrets set EXPO_PUBLIC_APP_URL=https://anymarket.expo.app

# EAS production (expo.dev → Environment variables)
EXPO_PUBLIC_APP_URL=https://anymarket.expo.app
EXPO_PUBLIC_SUPABASE_URL=https://jweyqlcvvmdyyqgqcsjd.supabase.co
```

---

## 1. Resend setup (once per environment)

### Test / development

1. Sign in at [resend.com](https://resend.com) and create an API key (**Sending access**).
2. **Without verified domain**, Resend only allows:
   - **From:** `onboarding@resend.dev`
   - **To:** `delivered@resend.dev` (and account email on some plans)
3. Store key in `supabase/functions/.env` locally — never commit.

### Production (camella.app)

1. Resend → **Domains** → add `camella.app`.
2. Add DNS records (SPF, DKIM) until status is **Verified**.
3. Create production API key.
4. Set:

   ```bash
   RESEND_FROM_EMAIL=AnyMarket <onboarding@camella.app>
   ```

5. Welcome links in email use `EXPO_PUBLIC_APP_URL` from Supabase secrets (`https://anymarket.expo.app`), **not** the email domain.

---

## 2. Local / test walkthrough

### 2.1 Prerequisites

```bash
cd /path/to/qbet
npm install
npx supabase start
npx supabase migration up --local
```

Confirm migrations:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20260625120000' ORDER BY version;"
```

Expected:

- `20260625120000` — beta access requests
- `20260626120000` — approval token + email tracking

### 2.2 App environment (`.env`)

```bash
cp .env.example .env
```

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=<publishable key from `npx supabase status`>
EXPO_PUBLIC_APP_URL=http://localhost:8081
EXPO_PUBLIC_LAUNCH_JURISDICTION=EC
EXPO_PUBLIC_BETA_REQUIRED=true
EXPO_PUBLIC_ADMIN_EMAIL=you@example.com
```

Restart dev server after changes.

### 2.3 Edge function secrets (`supabase/functions/.env`)

Gitignored. Copy from `supabase/functions/.env.example`:

```bash
RESEND_API_KEY=re_your_test_key
RESEND_FROM_EMAIL=AnyMarket <onboarding@resend.dev>
EXPO_PUBLIC_APP_URL=http://localhost:8081
```

| Scenario | `EXPO_PUBLIC_APP_URL` in functions env |
|----------|------------------------------------------|
| Full local loop (email → localhost welcome) | `http://localhost:8081` |
| Send real email but open prod welcome page | `https://anymarket.expo.app` |

Without Resend configured, copy `approval_token` from Studio after approve and open welcome URL manually.

### 2.4 Run app + functions

**Terminal A:**

```bash
npm run web
# → http://localhost:8081
```

**Terminal B (required for real email):**

```bash
npx supabase functions serve send-beta-approval-email --env-file supabase/functions/.env
```

Local endpoint: `http://127.0.0.1:54321/functions/v1/send-beta-approval-email`

### 2.5 Automated local test

```bash
npm run test:beta-approval-flow
# optional real Resend send:
RUN_BETA_EMAIL_TEST=1 npm run test:beta-approval-flow
```

### 2.6 Manual E2E

1. http://localhost:8081/request-access — submit (`delivered@resend.dev` if domain unverified)
2. Admin → http://localhost:8081/admin/users — approve (uses `window.confirm` on web)
3. **Approved** tab → **Approval email sent** or **Resend approval email**
4. Open email link or Studio token:

   `http://localhost:8081/beta/welcome?token=<uuid>`

5. **Sign up** with same email → `/onboarding/residence`

**Signed-in waitlist:** stay on `/onboarding/beta-waitlist`; within ~30s or on focus → **Continue onboarding**.

### 2.7 Local troubleshooting

| Symptom | Likely cause | Fix |
|--------|----------------|-----|
| Approve button silent (web) | Old `Alert.alert` behavior | Hard refresh; expect browser confirm dialog |
| `RESEND_API_KEY is not configured` | Missing functions env | Add to `supabase/functions/.env`; restart serve |
| Resend 403 / domain error | Unverified from domain | Use `onboarding@resend.dev` + `delivered@resend.dev` |
| Welcome link wrong host | URL mismatch | Align `EXPO_PUBLIC_APP_URL` in `.env` and functions env |
| Approve OK, no email | Function not served | Run `functions serve`; check logs |
| Admin “Email failed” | Resend rejected | Resend dashboard → Logs |

Mailpit (http://127.0.0.1:54324) is **Supabase Auth only**, not beta approval mail.

---

## 3. Production walkthrough

### 3.1 Link Supabase project

```bash
npx supabase login
npx supabase link --project-ref jweyqlcvvmdyyqgqcsjd
```

### 3.2 Apply database migration

```bash
npx supabase db push
```

Verify columns:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'beta_access_requests'
  AND column_name IN ('approval_token', 'approval_email_sent_at');
```

### 3.3 Set Supabase Edge Function secrets

```bash
npx supabase secrets set RESEND_API_KEY=re_your_production_key
npx supabase secrets set RESEND_FROM_EMAIL="AnyMarket <onboarding@camella.app>"
npx supabase secrets set EXPO_PUBLIC_APP_URL=https://anymarket.expo.app
npx supabase secrets list
```

### 3.4 Deploy edge function

```bash
npx supabase functions deploy send-beta-approval-email
npx supabase functions logs send-beta-approval-email --follow
```

Function config: `verify_jwt = true` in `supabase/config.toml` — caller must be authenticated admin.

### 3.5 EAS / Expo web environment

expo.dev → project → **Environment variables** → **production**:

| Variable | Value |
|----------|-------|
| `EXPO_PUBLIC_APP_URL` | `https://anymarket.expo.app` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://jweyqlcvvmdyyqgqcsjd.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_KEY` | anon / publishable key |
| `EXPO_PUBLIC_ADMIN_EMAIL` | admin email(s) |
| `EXPO_PUBLIC_BETA_REQUIRED` | `true` |
| `EXPO_PUBLIC_LAUNCH_JURISDICTION` | `EC` |

Do **not** put `RESEND_API_KEY` in EAS.

### 3.6 Deploy web app

```bash
npm run predeploy:prod
npm run deploy:web:prod
```

Or push to `master` for automatic EAS workflow — see [deploy-web-production.md](./deploy-web-production.md).

### 3.7 Production smoke test

1. https://anymarket.expo.app/request-access — real inbox you control
2. https://anymarket.expo.app/admin/users — approve
3. Email from `@camella.app`; link `https://anymarket.expo.app/beta/welcome?token=...`
4. Sign up / sign in with **same email**
5. Admin **Approved** tab shows **Approval email sent**
6. Idempotency: **Resend approval email** uses new idempotency key (`forceResend`)

### 3.8 Production troubleshooting

| Symptom | Check |
|--------|--------|
| 401 / 403 from function | Admin JWT; `users.is_admin` or `EXPO_PUBLIC_ADMIN_EMAIL` |
| Email link 404 | Redeploy web; confirm `/beta/welcome` in export |
| Email link localhost | Fix `EXPO_PUBLIC_APP_URL` secret; redeploy function |
| Resend domain error | Verify `camella.app`; update `RESEND_FROM_EMAIL` |
| `mark_beta_approval_email_sent` error | Re-run `db push`; migration `20260626120000` |

---

## 4. Deploy gate (automated)

Run before every production deploy:

```bash
npm run health                 # local: typecheck, lint, unit, SQL smoke
npm run verify                 # web export + unit + Deno email tests
npm run predeploy:prod         # verify + Supabase/Resend infra checks
```

| Test script | Covers |
|-------------|--------|
| `npm run test` | Node unit tests (intent, parsers, admin errors) |
| `npm run test:beta-approval-email` | Deno: HTML, welcome URL, idempotency key |
| `npm run test:beta-approval-sql` | SQL smoke: columns, RPCs, privileges |
| `npm run test:beta-approval-flow` | Integration: submit → approve → resolve |
| `npm run check-beta-approval-local-env` | Functions `.env` presence |

---

## 5. Quick reference: commands

**Local**

```bash
npx supabase start
npx supabase migration up --local
npm run web
npx supabase functions serve send-beta-approval-email --env-file supabase/functions/.env
npm run test:beta-approval-flow
```

**Production**

```bash
npx supabase link --project-ref jweyqlcvvmdyyqgqcsjd
npx supabase db push
npx supabase secrets set RESEND_API_KEY=re_...
npx supabase secrets set RESEND_FROM_EMAIL="AnyMarket <onboarding@camella.app>"
npx supabase secrets set EXPO_PUBLIC_APP_URL=https://anymarket.expo.app
npx supabase functions deploy send-beta-approval-email
npm run predeploy:prod
npm run deploy:web:prod
# or: git push origin master
```

---

## 6. Security notes

- Never commit `supabase/functions/.env`, `.env.local`, or live API keys.
- Approval links use opaque UUID tokens (`approval_token`), not email in query string.
- Edge function requires admin JWT; anonymous clients cannot trigger sends.
- Resend idempotency key `beta-approval/{requestId}` prevents duplicate sends; **Resend** uses new key on `forceResend`.
- Welcome token RPC is public (anon) but token is unguessable UUID.

---

## Related docs

- [local-dev-verification.md](./local-dev-verification.md) — broader local checklist
- [deploy-web-production.md](./deploy-web-production.md) — EAS web deploy + GitHub workflow
- [ec-beta-e2e-checklist.md](./ec-beta-e2e-checklist.md) — full QA checklist
- `.env.example` — client-safe variables
- `supabase/functions/.env.example` — function secrets template
