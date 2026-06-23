# Deploy walkthrough: Beta approval email flow

This guide covers **local/test** and **production** setup for the beta approval notification worktree:

- DB migration `20260626120000_beta_approval_notify.sql`
- Edge function `send-beta-approval-email` (Resend)
- Public route `/beta/welcome?token=...`
- Admin approve → email → welcome link → signup/onboarding

---

## What lives where

| Concern | Local / test | Production |
|--------|--------------|------------|
| Expo app (`.env`) | `EXPO_PUBLIC_*` → `.env` | EAS **production** environment |
| Resend API key | `supabase/functions/.env` | `supabase secrets set` (hosted project) |
| Email “from” address | `RESEND_FROM_EMAIL` in functions env | Verified domain in Resend |
| Welcome link base URL | `EXPO_PUBLIC_APP_URL` in **both** app `.env` and functions env | Same — must match canonical web URL |
| DB schema | `npx supabase migration up --local` | `supabase db push` |
| Edge function code | `supabase functions serve` (optional) | `supabase functions deploy send-beta-approval-email` |

**Important:** `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are **Supabase Edge Function secrets only**. They do not belong in `.env` (client bundle) or EAS unless you have another server that sends mail (this project does not).

Supabase injects these automatically into deployed functions (you do not set them manually):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 1. Resend setup (once per environment)

### Test / development

1. Sign in at [resend.com](https://resend.com) and create an API key (**Sending access** is enough).
2. Without a verified domain, Resend only allows:
   - **From:** `onboarding@resend.dev` (or the default in the edge function)
   - **To:** `delivered@resend.dev` (and your Resend account email for some plans)
3. Use a **test** API key (`re_...`) — never commit it. Store in `supabase/functions/.env` locally or `supabase secrets set` on the hosted project.

### Production

1. In Resend → **Domains** → add your sending domain (e.g. `anymarket.app`).
2. Add the DNS records Resend shows (SPF, DKIM, etc.) and wait until status is **Verified**.
3. Create a **production** API key with send access.
4. Set `RESEND_FROM_EMAIL` to an address on that domain, e.g. `AnyMarket <onboarding@anymarket.app>`.

---

## 2. Local / test walkthrough

### 2.1 Prerequisites

```bash
cd /path/to/qbet
npm install
npx supabase start
npx supabase migration up --local
```

Confirm migrations applied:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT version FROM supabase_migrations.schema_migrations WHERE version >= '20260625120000' ORDER BY version;"
```

You should see at least:

- `20260625120000` — beta access requests
- `20260626120000` — approval token + email tracking

### 2.2 App environment (`.env`)

Copy from `.env.example`:

```bash
cp .env.example .env
```

Set:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=<publishable key from `npx supabase status`>
EXPO_PUBLIC_APP_URL=http://localhost:8081
EXPO_PUBLIC_LAUNCH_JURISDICTION=EC
EXPO_PUBLIC_BETA_REQUIRED=true
EXPO_PUBLIC_ADMIN_EMAIL=you@example.com
```

Restart the dev server after changing `.env`.

### 2.3 Edge function secrets (`supabase/functions/.env`)

Create or edit **`supabase/functions/.env`** (gitignored). Add:

```bash
RESEND_API_KEY=re_your_test_key
RESEND_FROM_EMAIL="AnyMarket <onboarding@resend.dev>"
EXPO_PUBLIC_APP_URL=http://localhost:8081
```

This file is loaded when you run `supabase functions serve`. It is **not** used by the Expo app.

For local testing without Resend, you can still exercise the welcome page by copying `approval_token` from Studio after approve (see §2.6 step 5).

### 2.4 Run app + functions locally

**Terminal A — web app:**

```bash
npm run web
# → http://localhost:8081
```

**Terminal B — edge functions (optional but required for real email sends):**

```bash
npx supabase functions serve send-beta-approval-email --env-file supabase/functions/.env
```

When the app invokes the function against **local** Supabase, the CLI serves it at:

`http://127.0.0.1:54321/functions/v1/send-beta-approval-email`

If you skip `functions serve`, approve will succeed in the DB but the admin UI may show email failed until secrets + serve are configured.

### 2.5 End-to-end local test

1. Open http://localhost:8081/request-access
2. Submit with **`delivered@resend.dev`** (Resend test recipient) or your own email if domain is verified.
3. Sign in as admin → http://localhost:8081/admin/users
4. Approve the pending request.
5. In the **Approved** tab, confirm **Approval email sent** (or **Resend approval email** if the first send failed).
6. Either:
   - Open the link from the Resend dashboard / inbox, or
   - In Studio → `beta_access_requests` → copy `approval_token` and open:
     `http://localhost:8081/beta/welcome?token=<uuid>`
7. Click **Sign up** → complete auth with the **same email** → should route past waitlist to `/onboarding/residence`.

**Signed-in waitlist user:** leave the app on `/onboarding/beta-waitlist` after approve; within ~30s (or on app focus) the UI should show approved + **Continue onboarding**.

### 2.6 Local troubleshooting

| Symptom | Likely cause | Fix |
|--------|----------------|-----|
| `RESEND_API_KEY is not configured` in function logs | Missing functions env | Add key to `supabase/functions/.env`, restart `functions serve` |
| Resend 403 / domain error | Unverified `from` domain | Use `onboarding@resend.dev` + `delivered@resend.dev` in test |
| Welcome link goes to wrong host | `EXPO_PUBLIC_APP_URL` mismatch | Set same value in `.env` and `supabase/functions/.env` |
| Approve works, no email | Function not served / secrets missing | Run `functions serve`, check `supabase functions logs` locally |
| Admin sees “Email failed” | Resend rejected send | Resend dashboard → **Logs**; fix from/to addresses |

Mailpit (http://127.0.0.1:54324) is for **Supabase Auth** emails only, not beta approval mail.

---

## 3. Production walkthrough

Assumes: hosted Supabase project linked, EAS project for web deploy, Resend domain verified.

### 3.1 Link Supabase project (if not already)

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

### 3.2 Apply database migration

```bash
npx supabase db push
```

Verify in Supabase Dashboard → **Database** → **Migrations**, or SQL Editor:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'beta_access_requests'
  AND column_name IN ('approval_token', 'approval_email_sent_at');
```

### 3.3 Set Supabase Edge Function secrets

All secrets are shared across functions on the project:

```bash
npx supabase secrets set RESEND_API_KEY=re_your_production_key
npx supabase secrets set RESEND_FROM_EMAIL="AnyMarket <onboarding@yourdomain.com>"
npx supabase secrets set EXPO_PUBLIC_APP_URL=https://anymarket.expo.app
```

List (names only):

```bash
npx supabase secrets list
```

`EXPO_PUBLIC_APP_URL` in Supabase secrets is used **only by edge functions** (email link generation). It must match the URL users actually open.

### 3.4 Deploy the edge function

```bash
npx supabase functions deploy send-beta-approval-email
```

Tail logs after a test approve:

```bash
npx supabase functions logs send-beta-approval-email --follow
```

### 3.5 EAS / Expo web environment

In [expo.dev](https://expo.dev) → your project → **Environment variables** → **production**:

| Variable | Example |
|----------|---------|
| `EXPO_PUBLIC_APP_URL` | `https://anymarket.expo.app` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_KEY` | anon / publishable key |
| `EXPO_PUBLIC_ADMIN_EMAIL` | admin email(s), comma-separated |
| `EXPO_PUBLIC_BETA_REQUIRED` | `true` |
| `EXPO_PUBLIC_LAUNCH_JURISDICTION` | `EC` |

Do **not** put `RESEND_API_KEY` in EAS — it stays in Supabase secrets.

### 3.6 Deploy web app

From repo root:

```bash
npm run deploy:web:prod
```

This runs typecheck, lint, export, and `eas deploy --prod`. See [deploy-web-production.md](./deploy-web-production.md).

### 3.7 Production smoke test

1. Submit a real access request at `https://anymarket.expo.app/request-access` (use a real inbox you control).
2. Approve in **Admin → Users** on production.
3. Confirm email arrives; link should be `https://anymarket.expo.app/beta/welcome?token=...`
4. Complete signup/sign-in with the same email.
5. In admin **Approved** tab, confirm **Approval email sent** timestamp.
6. Optional idempotency check: click **Resend approval email** once — should succeed without duplicate confusion (new idempotency key on forced resend).

### 3.8 Production troubleshooting

| Symptom | Check |
|--------|--------|
| 401 / 403 from function | Caller must be signed-in **admin** (`users.is_admin = true` or `EXPO_PUBLIC_ADMIN_EMAIL`) |
| Email link 404 | Redeploy web so `/beta/welcome` exists in `dist/` |
| Email link wrong domain | `supabase secrets set EXPO_PUBLIC_APP_URL=...` then redeploy function |
| Resend “domain not verified” | Finish DNS verification; update `RESEND_FROM_EMAIL` |
| `mark_beta_approval_email_sent` error | Re-run `db push`; confirm migration `20260626120000` applied |

---

## 4. Quick reference: commands

**Local**

```bash
npx supabase start
npx supabase migration up --local
npm run web
npx supabase functions serve send-beta-approval-email --env-file supabase/functions/.env
```

**Production**

```bash
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase secrets set RESEND_API_KEY=re_...
npx supabase secrets set RESEND_FROM_EMAIL="AnyMarket <onboarding@yourdomain.com>"
npx supabase secrets set EXPO_PUBLIC_APP_URL=https://anymarket.expo.app
npx supabase functions deploy send-beta-approval-email
npm run deploy:web:prod
```

---

## 5. Security notes

- Never commit `supabase/functions/.env`, `.env.local`, or live API keys.
- Approval links use opaque UUID tokens (`approval_token`), not email in the query string.
- The edge function requires an admin JWT; anonymous clients cannot trigger sends.
- Resend idempotency key `beta-approval/{requestId}` prevents duplicate sends on retry; **Resend** uses a new key with `forceResend`.

---

## Deploy gate (automated)

Run before every production deploy:

```bash
npm run health                 # local sanity (includes unit + SQL when Supabase up)
npm run verify                 # web export + all unit + Deno email tests
npm run predeploy:prod         # verify + Supabase secrets/function/migration checks
```

Optional local integration (no Resend by default):

```bash
npm run test:beta-approval-flow
RUN_BETA_EMAIL_TEST=1 npm run test:beta-approval-flow   # includes real Resend send
```

Production welcome links must use **`https://anymarket.expo.app`**. Email may send from **`@camella.app`** (verified Resend domain).

---

## Related docs

- [local-dev-verification.md](./local-dev-verification.md) — broader local checklist
- [deploy-web-production.md](./deploy-web-production.md) — EAS web deploy
- `.env.example` — client-safe variables
