# AnyMarket (qbet)

Social prediction infrastructure for private groups — **web** (Expo Router) + **Supabase** backend + **Stripe** payments.

**Production:** https://anymarket.expo.app  
**Repo:** https://github.com/rcdev714/qbet

---

## Quick start (local)

```bash
npm install
cp .env.example .env          # fill Supabase + Stripe public keys
cp supabase/functions/.env.example supabase/functions/.env  # Resend for approval emails
npx supabase start
npx supabase migration up --local
npm run web
```

Open http://localhost:8081

**Supabase Studio:** http://127.0.0.1:54323  
**Mailpit (auth emails only):** http://127.0.0.1:54324

---

## Documentation

Full index: **[docs/README.md](./docs/README.md)**

| Doc | Purpose |
|-----|---------|
| [docs/local-dev-verification.md](./docs/local-dev-verification.md) | Local setup, env, migrations, tests |
| [docs/deploy-web-production.md](./docs/deploy-web-production.md) | Web deploy + GitHub auto-deploy |
| [docs/deploy-beta-approval-notify.md](./docs/deploy-beta-approval-notify.md) | Beta approval email (Resend) |
| [docs/ec-beta-e2e-checklist.md](./docs/ec-beta-e2e-checklist.md) | Pre-launch E2E checklist |

---

## Health and release gates

```bash
npm run health              # local sanity (typecheck, lint, tests, SQL smoke)
npm run verify              # web export + unit + Deno tests
npm run predeploy:prod      # verify + prod infra checks (Supabase, Resend)
npm run deploy:web:prod     # manual production web deploy
```

**Automatic web deploy:** push to `master` triggers [`.eas/workflows/deploy-web-production.yml`](./.eas/workflows/deploy-web-production.yml) (web only — no iOS/Android auto-build).

---

## Stack

| Layer | Technology |
|-------|------------|
| App | Expo 54, Expo Router, React Native Web |
| Backend | Supabase (Postgres, Auth, RLS, Edge Functions) |
| Payments | Stripe (Identity, Connect, deposits) |
| Email (beta approval) | Resend via `send-beta-approval-email` edge function |
| Web hosting | EAS Hosting → `anymarket.expo.app` |
| i18n | English + Spanish (`lib/i18n/`) |

---

## Beta access (EC private beta)

Two paths to access:

1. **Request form** — `/request-access` → admin approves at `/admin/users` → approval email → `/beta/welcome?token=...`
2. **Direct invite** — email in `public.beta_invites` (legacy/manual)

| Route | Purpose |
|-------|---------|
| `/request-access` | Public beta request form |
| `/admin/users` | Admin approve/decline queue |
| `/beta/welcome` | Post-approval landing (from email link) |
| `/onboarding/beta-waitlist` | Shown when signed in but not yet approved |

WhatsApp contact CTA: configured in [`lib/contact.ts`](./lib/contact.ts).

---

## Environment (summary)

**App** (`.env` — client-safe, embedded in bundle):

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=<anon key>
EXPO_PUBLIC_APP_URL=http://localhost:8081
EXPO_PUBLIC_BETA_REQUIRED=true
EXPO_PUBLIC_LAUNCH_JURISDICTION=EC
EXPO_PUBLIC_ADMIN_EMAIL=admin@example.com
```

**Edge functions** (`supabase/functions/.env` — gitignored):

```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=AnyMarket <onboarding@camella.app>
EXPO_PUBLIC_APP_URL=http://localhost:8081   # or https://anymarket.expo.app for real email links
```

**Production Supabase secrets:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EXPO_PUBLIC_APP_URL=https://anymarket.expo.app`

Full matrix: [docs/deploy-beta-approval-notify.md](./docs/deploy-beta-approval-notify.md)

---

## Production deploy (checklist)

```bash
npm run predeploy:prod
npx supabase db push
npx supabase functions deploy send-beta-approval-email
git push origin master          # triggers EAS web deploy workflow
# or manually:
npm run deploy:web:prod
```

Smoke test: request-access → admin approve → email → welcome link → signup → residence onboarding.

---

## Project structure (key paths)

```
app/                    Expo Router screens
  request-access.tsx    Beta request form
  beta/welcome.tsx      Email return landing
  admin/users.tsx       Admin access queue
  onboarding/           Residence, policies, waitlist
components/admin/       Admin shell UI
services/betaAccess.*   Beta access RPC + email invoke
supabase/migrations/    Database schema
supabase/functions/     Edge functions (Stripe, Resend, etc.)
scripts/                Health checks, deploy helpers, tests
docs/                   Documentation index
.eas/workflows/         GitHub-triggered EAS workflows
```
