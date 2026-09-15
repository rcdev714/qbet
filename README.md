# Anymarkt (qbet)

Social prediction infrastructure for private groups — **Vite web** (rewrite in progress) + **Expo** (native / legacy web) + **Supabase** + **Stripe**.

**Production (current):** https://anymarkt.com via **EAS Hosting**  
**Web rewrite target:** Vite SPA on **Vercel** (`apps/web`) — see [docs/vercel-web-cutover.md](./docs/vercel-web-cutover.md)  
**Repo:** https://github.com/rcdev714/qbet

---

## Quick start (local)

```bash
npm install
cp .env.example .env          # fill Supabase + Stripe public keys
cp supabase/functions/.env.example supabase/functions/.env  # Resend for approval emails
npx supabase start
npx supabase migration up --local

# Primary web rewrite (Vite)
npm run web:vite              # http://localhost:5173

# Legacy Expo RN Web (still used for EAS prod until cutover)
npm run web                   # http://localhost:8081
```

**Supabase Studio:** http://127.0.0.1:54323  
**Mailpit (auth emails only):** http://127.0.0.1:54324

---

## Monorepo layout

```
apps/web/           Vite + React + React Router + Tailwind + shadcn (new web)
apps/mobile/        Notes — Expo stays at repo root until native move
packages/shared/    RN-free auth, beta-access, supabase helpers, brand
app/                Expo Router screens (native + legacy web)
supabase/           Migrations + Edge Functions (share/OG stays here)
```

`@anymarkt/shared` must not import `react-native` or Expo modules. Expo continues to use root `lib/` / `services/` until a later migration.

---

## Documentation

Full index: **[docs/README.md](./docs/README.md)**

| Doc | Purpose |
|-----|---------|
| [docs/vercel-web-cutover.md](./docs/vercel-web-cutover.md) | Vercel project, env, SPA rewrites, DNS cutover |
| [docs/local-dev-verification.md](./docs/local-dev-verification.md) | Local setup, env, migrations, tests |
| [docs/deploy-web-production.md](./docs/deploy-web-production.md) | Current EAS web deploy (production today) |
| [docs/deploy-beta-approval-notify.md](./docs/deploy-beta-approval-notify.md) | Beta approval email (Resend) |
| [docs/ec-beta-e2e-checklist.md](./docs/ec-beta-e2e-checklist.md) | Pre-launch E2E checklist |

---

## Health and release gates

```bash
npm run typecheck:web       # Vite + shared
npm run health              # local sanity (typecheck, lint, tests, SQL smoke)
npm run verify              # Expo web export + unit + Deno tests
npm run predeploy:prod      # verify + prod infra checks (Supabase, Resend)
npm run deploy:web:prod     # manual EAS production web deploy (unchanged)
```

**Automatic web deploy (EAS):** push to `master` triggers [`.eas/workflows/deploy-web-production.yml`](./.eas/workflows/deploy-web-production.yml). Do not remove until Vercel cutover is approved.

---

## Stack

| Layer | Technology |
|-------|------------|
| Web (rewrite) | Vite, React 19, React Router, TypeScript, Tailwind, shadcn |
| Web (prod today) | Expo 54, Expo Router, React Native Web → EAS Hosting |
| Native | Expo (root; future `apps/mobile`) |
| Shared | `@anymarkt/shared` — Supabase client, auth, beta access |
| Backend | Supabase (Postgres, Auth, RLS, Edge Functions) |
| Payments | Stripe (Identity, Connect, deposits) |
| Email (beta approval) | Resend via `send-beta-approval-email` |
| Share / OG | Edge (`share-redirect` + share-preview) — not Next.js |
| i18n | English + Spanish (`lib/i18n/`) — Expo; web i18n is P2 |

---

## Beta access (EC private beta)

Two paths to access:

1. **Request form** — `/request-access` → admin approves at `/admin/users` → approval email → `/beta/welcome?token=...`
2. **Direct invite** — email in `public.beta_invites` (legacy/manual)

| Route | Purpose |
|-------|---------|
| `/request-access` | Public beta request form |
| `/admin/users` | Admin approve/decline queue (Expo; web P2) |
| `/beta/welcome` | Post-approval landing (from email link) |
| `/onboarding/beta-waitlist` | Shown when signed in but not yet approved |

WhatsApp contact CTA: configured in [`packages/shared`](./packages/shared/src/brand.ts) / [`lib/contact.ts`](./lib/contact.ts).

---

## Environment (summary)

**App** (`.env` — client-safe):

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_KEY=<anon key>
EXPO_PUBLIC_APP_URL=http://localhost:8081
# Vite also accepts VITE_* mirrors; EXPO_PUBLIC_* works for apps/web via envPrefix
EXPO_PUBLIC_BETA_REQUIRED=true
EXPO_PUBLIC_LAUNCH_JURISDICTION=EC
EXPO_PUBLIC_ADMIN_EMAIL=admin@example.com
```

**Edge functions** (`supabase/functions/.env` — gitignored):

```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Anymarkt <onboarding@anymarkt.com>
EXPO_PUBLIC_APP_URL=http://localhost:8081   # or https://anymarkt.com for real email links
```

Full matrix: [docs/deploy-beta-approval-notify.md](./docs/deploy-beta-approval-notify.md) · [docs/vercel-web-cutover.md](./docs/vercel-web-cutover.md)

---

## P2 checklist (after this rewrite scaffold)

- [ ] Feed / home authenticated shell
- [ ] Groups + markets + market detail
- [ ] Wallet / top-up / Stripe
- [ ] Admin users queue on Vite
- [ ] i18n parity
- [ ] Move Expo → `apps/mobile`
- [ ] DNS cutover anymarkt.com → Vercel (keep share/OG on Edge)
