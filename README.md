# AnyMarket (qbet)

Social prediction infrastructure for private groups — web (Expo) + Supabase backend.

## Quick start

```bash
npm install
cp .env.example .env   # fill in Supabase + Stripe public keys
npx supabase start
npx supabase migration up --local
npm run web
```

Open http://localhost:8081

## Health checks

```bash
npm run typecheck
npm run lint
npm run check:web:prod   # typecheck + lint + static web export
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [docs/local-dev-verification.md](./docs/local-dev-verification.md) | Local setup, migrations, auth/beta verification |
| [docs/ec-beta-e2e-checklist.md](./docs/ec-beta-e2e-checklist.md) | EC private beta E2E test plan |
| [docs/ec-counsel-launch-checklist.md](./docs/ec-counsel-launch-checklist.md) | Legal/counsel launch gate |
| [docs/deploy-web-production.md](./docs/deploy-web-production.md) | Web production deploy |
| [docs/multi-jurisdiction-compliance.md](./docs/multi-jurisdiction-compliance.md) | US/EC compliance model |

## Stack

- **App:** Expo Router (React Native Web + iOS/Android)
- **Backend:** Supabase (Postgres, Auth, Edge Functions, RLS)
- **Payments:** Stripe (Identity, Connect, deposits)

## Beta access (EC)

- Landing page: WhatsApp request access (`lib/contact.ts`)
- Auth: **Log in** (nav) → `/login` → **Create account** for invited emails
- Allowlist: `public.beta_invites`
