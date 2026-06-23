# Local full-stack E2E testing

Automated local verification with **real** Supabase RPCs, Stripe test mode (Identity + Checkout), Resend, and Playwright against Expo web.

**Related:** [local-dev-verification.md](./local-dev-verification.md) · [ec-beta-e2e-checklist.md](./ec-beta-e2e-checklist.md) · [deploy-bet-contract-email.md](./deploy-bet-contract-email.md)

---

## Prerequisites

| Tool | Purpose |
|------|---------|
| Docker + Supabase CLI | Local Postgres, Auth, Edge Functions |
| Stripe CLI | Forward webhooks to local functions |
| Stripe test keys | `pk_test_` / `sk_test_` in `.env` and `supabase/functions/.env` |
| Resend test key | Contract + beta emails (`delivered@resend.dev` recipients) |
| Admin user | `update public.users set is_admin = true where email = 'you@example.com';` |
| Admin password for Playwright | Set `E2E_ADMIN_PASSWORD` (default: `E2eAdmin!Test1`, reset by `run-local-e2e.sh`) — **not** the test user password |

---

## One-command run

```bash
npm run test:e2e
```

This runs [`scripts/run-local-e2e.sh`](../scripts/run-local-e2e.sh):

1. Validates env (`check-e2e-local-env.sh`)
2. Applies migrations
3. Starts dual `stripe listen` forwarders
4. Serves edge functions (Stripe, contracts, beta)
5. Starts `npm run web`
6. Runs Playwright

---

## Split runs

| Command | What it does |
|---------|----------------|
| `npm run test:e2e:env` | Env + migration + tooling check only |
| `npm run test:e2e:api` | Backend RPC flow (beta + bet contract), no browser |
| `npm run test:e2e:ui` | Playwright only (services must already be running) |

### API-only bet contract (fast)

```bash
# Requires local Supabase + functions serve + E2E_API_SETUP user seed
E2E_API_SETUP=1 npm run test:e2e:api

# Include real Resend send
RUN_BET_CONTRACT_EMAIL_TEST=1 E2E_API_SETUP=1 npm run test:e2e:api
```

---

## Stripe local setup

1. Log in: `stripe login`
2. Start listeners (or let `run-local-e2e.sh` do it):

```bash
bash scripts/stripe-e2e-listen.sh
```

3. Copy secrets from `tests/e2e/.stripe-secrets.env` into `supabase/functions/.env`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_...
```

4. Restart `supabase functions serve` after secret rotation.

### Test data

| Flow | Test value |
|------|------------|
| Checkout card | `4242 4242 4242 4242`, any future expiry, any CVC |
| Identity | Stripe test mode document flow (see [Stripe Identity testing](https://docs.stripe.com/identity/testing)) |
| Email recipient | `*@resend.dev` (e.g. `e2e-123@resend.dev`) |

---

## Playwright layout

```
tests/e2e/
  global-setup.ts           # seed-e2e-fixtures.ts + wait for web
  global-teardown.ts        # optional DB assertions
  admin-setup.spec.ts       # admin storageState
  beta-flow.spec.ts         # request-access + admin approve
  user-setup.spec.ts        # signup, onboard, API wallet seed, user storageState
  live-bet-contract.spec.ts # critical: live bet → contract → resolve
  stripe-flow.spec.ts       # optional (E2E_STRIPE_UI=1): Identity + Checkout
  helpers/
    auth.ts
    seed-user.ts            # enableLiveWalletForUser (bypass Stripe UI)
    stripe-checkout.ts
    stripe-identity.ts
    admin-beta.ts
    assert-db.ts
  .runtime/e2e-state.json   # gitignored credentials + fixture IDs
```

### Project chain

Playwright runs projects in order: `admin-setup` → `beta-flow` → `user-setup` → `live-bet-contract`. Stripe UI tests (`stripe-flow`) are skipped unless `E2E_STRIPE_UI=1`.

### Bypass vs critical paths

| Path | How |
|------|-----|
| Stripe Identity + deposit | Skipped in default UI run; `enableLiveWalletForUser()` seeds KYC + balance |
| Beta + onboarding | Exercised in browser (critical for EC launch flow) |
| Live bet + contract + resolve | Exercised in browser (critical) |
| Stripe iframes | `E2E_STRIPE_UI=1 npm run test:e2e:ui` |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `STRIPE_WEBHOOK_SECRET missing` | Run `stripe-e2e-listen.sh`, merge secrets, restart functions |
| KYC never verifies | Identity listener running; check `stripe-identity-webhook` logs |
| Deposit succeeds but balance 0 | Payment listener → `stripe-webhook`; check webhook secret |
| `Compliance gate denied` | Complete onboarding policies + Identity in UI order |
| Playwright timeout on first load | Expo cold start — increase timeout or pre-open `npm run web` |
| Alert blocks click | Helpers register `page.on('dialog')` accept handler |

---

## CI posture

Full E2E is **local-only** for now (Docker + Stripe CLI + secrets). Do not run in GitHub Actions until a dedicated E2E Stripe account and secret management exist.
