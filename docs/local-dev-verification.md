# Local development and verification

Use this checklist before beta invites or web deploys.

## Prerequisites

- Node.js 20+
- Docker (for local Supabase)
- Supabase CLI (`npx supabase`)

## Environment

1. Copy `.env.example` → `.env` and set client vars:

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   EXPO_PUBLIC_SUPABASE_KEY=<local publishable key from supabase status>
   EXPO_PUBLIC_APP_URL=http://localhost:8081
   EXPO_PUBLIC_LAUNCH_JURISDICTION=EC
   EXPO_PUBLIC_BETA_REQUIRED=true
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```

2. Optional server secrets in `.env.local` for share routes and Stripe webhooks.

3. Beta access contact (WhatsApp) is configured in [`lib/contact.ts`](../lib/contact.ts).

## Start Supabase locally

```bash
npx supabase start
npx supabase migration up --local
npx supabase status
```

Studio: http://127.0.0.1:54323  
Mailpit (auth emails): http://127.0.0.1:54324

### Seed a beta invite

```sql
insert into public.beta_invites (email)
values ('your-test@example.com')
on conflict (email) do nothing;
```

## Health checks

```bash
npm run health              # typecheck, lint, unit tests, SQL smoke (when Supabase local up)
npm run test                # all Node unit tests
npm run test:beta-approval-email   # Deno tests for email helpers (requires deno)
npm run test:beta-approval-sql     # SQL smoke (local Supabase)
npm run test:beta-approval-flow    # submit → approve → resolve integration
npm run verify              # check:web:prod + unit + Deno email tests
npm run predeploy:prod      # verify + Supabase/Resend infra warnings
```

Expected: no type errors, web export succeeds to `dist/`, 23+ unit tests pass.

SQL regression checks live in `supabase/tests/` (beta approval + payment hardening).

### Optional SQL smoke test (requires pgTap)

Install pgTap in local Postgres, then:

```bash
npm run test:beta-approval-sql
# or manually:
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/tests/beta_approval_notify.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/tests/payment_flow_hardening.sql
```

Without pgTap, `test-beta-approval-sql.sh` runs basic column/function checks automatically.

## Run the app

```bash
npm install
npm run web
```

Open http://localhost:8081

## Auth and onboarding flow (EC beta)

| Step | Where | Expected |
|------|--------|----------|
| Landing | `/` | **Request access** primary CTA; WhatsApp secondary; **Log in** in nav |
| Request access | `/request-access` | Form submits to `beta_access_requests`; success banner shows submitted email |
| Sign up | `/login` → Create account | Email/password or Google (web) |
| Beta gate | invited email | Proceeds to residence |
| Beta gate | non-invited email | `/onboarding/beta-waitlist` (can submit via **Request access**) |
| Admin review | `/admin/users` | Approve/decline pending requests (admin only) |
| Residence | `/onboarding/residence` | Ecuador only when `EC` launch |
| Policies | `/onboarding/policies` | 17+ + policy acceptances required |
| App | `/(tabs)` | Feed after onboarding complete |

## Migrations to verify (EC launch)

All four should appear in `supabase_migrations.schema_migrations`:

- `20260623120000_ec_launch_beta.sql` — beta allowlist, age attestation, UGC
- `20260623120001_ec_policy_versions_sync.sql`
- `20260623120002_legal_compliance_policy_pack.sql`
- `20260623120003_legal_policy_references.sql`

- `20260625120000_beta_access_requests.sql` — public request form + admin approve/decline
- `20260626120000_beta_approval_notify.sql` — approval token, email sent tracking, welcome link RPC

Quick check:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20260626%' OR version LIKE '20260625%' ORDER BY version;"
```

### Test the access request form locally

1. Ensure `.env` points at local Supabase (`EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and the anon key from `npx supabase status`).
2. Run `npm run web` and open http://localhost:8081/request-access
3. Submit with an Ecuador country + test email — you should see a green **Request received** banner with your email.
4. As admin, open http://localhost:8081/admin/users to approve the request.

If submit fails with a configuration error, run `npx supabase migration up --local` again.

### Test beta approval email + welcome link

Mailpit (local Supabase) handles **auth** emails only. Beta approval emails go through **Resend** via the `send-beta-approval-email` edge function.

1. Set Supabase edge function secrets (local `.env` in `supabase/functions/.env` or `supabase secrets set` for remote):

   ```bash
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL="AnyMarket <onboarding@yourdomain.com>"
   EXPO_PUBLIC_APP_URL=http://localhost:8081
   ```

   Resend test mode accepts `delivered@resend.dev` as recipient.

2. Apply migrations: `npx supabase migration up --local`

3. Submit a request at `/request-access`, then approve it in **Admin → Users**.

4. Confirm the approved row shows **Approval email sent** (or use **Resend approval email** if it failed).

5. Open the welcome link from the email (or from DB: `approval_token` on `beta_access_requests`):

   `http://localhost:8081/beta/welcome?token=<approval_token>`

6. You should see **You're approved**, intent saved in local storage, and CTAs to sign up or sign in with the same email.

Full deploy walkthrough (Resend + Supabase secrets + prod): [deploy-beta-approval-notify.md](./deploy-beta-approval-notify.md).

## Deploy web (production)

See [deploy-web-production.md](./deploy-web-production.md).
