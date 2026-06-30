# Feed suggestions — deployment runbook

Admin-only AI market ideas (Gemini + Google Search) generated at **8am, 12pm, and 3pm US Eastern**.

**Related:** [e2e-local.md](./e2e-local.md) · [notifications-and-email.md](./notifications-and-email.md)

---

## Architecture (quick reference)

```
pg_cron (hourly UTC)
  → pg_net POST → generate-feed-suggestions (edge function)
    → ET hour gate {8, 12, 15}
    → Gemini API + Google Search
    → source/date/compliance scoring
    → feed_suggestion_batches + feed_market_suggestions
      → Admin Feed Manager → Suggestions tab
      → process-feed-suggestion-autopilot (dry-run by default)
```

---

## Environment variables reference

### Summary table

| Variable | Required | Where it lives | Used by |
|----------|----------|----------------|---------|
| `GEMINI_API_KEY` | Yes (for generation) | Edge function secrets | `generate-feed-suggestions`, `generate-image` |
| `CRON_INVOKER_SECRET` | Yes (for cron + manual invoke) | Edge function secret **and** Vault | pg_cron → edge function auth |
| `GEMINI_FEED_MODEL` | No | Edge function secret | Default `gemini-2.5-flash` |
| `AUTOPILOT_FEED_SUGGESTIONS_ENABLED` | No | Edge function secret | Default `false`; controls auto-creation |
| `AUTOPILOT_FEED_MAX_MARKETS_PER_RUN` | No | Edge function secret | Default `1`; caps auto-created markets |
| `AUTOPILOT_FEED_MIN_SCORE` | No | Edge function secret | Default `85`; minimum local score |
| `AUTOPILOT_FEED_ALLOWED_CATEGORIES` | No | Edge function secret | Default `Entertainment,Tech,Economy` |
| Vault `project_url` | Yes (prod cron only) | Supabase Vault (DB) | `invoke_feed_suggestions_cron()` |
| Vault `cron_invoker_secret` | Yes (prod cron only) | Supabase Vault (DB) | Same value as `CRON_INVOKER_SECRET` |
| `SUPABASE_URL` | Auto | Injected in edge runtime | All edge functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | Injected in edge runtime | Edge function DB writes |
| `EXPO_PUBLIC_ADMIN_EMAIL` | App only | Root `.env` | Shows admin UI affordances |

**Not needed in the Expo app** — suggestions are server-side + admin UI only. No `EXPO_PUBLIC_*` vars for this feature.

---

### `GEMINI_API_KEY`

| | |
|---|---|
| **What** | Google AI Studio API key for Gemini (text + search grounding + Imagen) |
| **Format** | `AIzaSy...` (39 chars, starts with `AIza`) |
| **Where to get** | [Google AI Studio → API keys](https://aistudio.google.com/apikey) |
| **Local** | `supabase/functions/.env` |
| **Production** | `supabase secrets set GEMINI_API_KEY=AIzaSy...` |

```bash
# supabase/functions/.env
GEMINI_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
```

Enable **Generative Language API** on the Google Cloud project linked to the key. Billing may apply for search-grounded calls.

---

### `CRON_INVOKER_SECRET`

| | |
|---|---|
| **What** | Shared bearer token so pg_cron (and you) can call `generate-feed-suggestions` without exposing the service role key |
| **Format** | Random string, ≥ 32 bytes. Example: 64-char hex |
| **How to generate** | `openssl rand -hex 32` |
| **Local** | `supabase/functions/.env` |
| **Production** | Edge secret **and** Vault secret (same value) |

```bash
# Generate once per environment
openssl rand -hex 32
# → a1b2c3d4e5f6...  (64 hex chars)

# supabase/functions/.env (local)
CRON_INVOKER_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# Production edge secret
supabase secrets set CRON_INVOKER_SECRET=a1b2c3d4e5f6...

# Production Vault (Dashboard → Database → Vault, or SQL Editor)
select vault.create_secret(
  'a1b2c3d4e5f6...',
  'cron_invoker_secret',
  'Must match CRON_INVOKER_SECRET edge secret'
);
```

**Important:** `CRON_INVOKER_SECRET` in edge secrets and Vault `cron_invoker_secret` must be **identical**.

---

### `GEMINI_FEED_MODEL` (optional)

| | |
|---|---|
| **Default** | `gemini-2.5-flash` |
| **Format** | Model id string, no `models/` prefix |
| **Examples** | `gemini-2.5-flash`, `gemini-2.5-pro` |

```bash
GEMINI_FEED_MODEL=gemini-2.5-flash
```

---

### Autopilot controls (optional, keep safe by default)

| Variable | Default | Notes |
|----------|---------|-------|
| `AUTOPILOT_FEED_SUGGESTIONS_ENABLED` | `false` | When false, eligible suggestions are only badged in admin. |
| `AUTOPILOT_FEED_MAX_MARKETS_PER_RUN` | `1` | Hard-capped in the processor to avoid runaway creation. |
| `AUTOPILOT_FEED_MIN_SCORE` | `85` | Local score threshold, independent of Gemini. |
| `AUTOPILOT_FEED_ALLOWED_CATEGORIES` | `Entertainment,Tech,Economy` | Comma-separated allowlist. |

```bash
AUTOPILOT_FEED_SUGGESTIONS_ENABLED=false
AUTOPILOT_FEED_MAX_MARKETS_PER_RUN=1
AUTOPILOT_FEED_MIN_SCORE=85
AUTOPILOT_FEED_ALLOWED_CATEGORIES=Entertainment,Tech,Economy
```

Autopilot is intentionally split into a separate function: `process-feed-suggestion-autopilot`. The generation function only creates scored suggestions.

---

### Vault `project_url` (production cron only)

| | |
|---|---|
| **What** | Base URL of your Supabase project (no trailing slash) |
| **Format** | `https://<project-ref>.supabase.co` |
| **Where to find** | Supabase Dashboard → Project Settings → API → Project URL |

```sql
select vault.create_secret(
  'https://abcdefghijklmnop.supabase.co',
  'project_url',
  'Supabase project URL for pg_cron HTTP'
);
```

Local dev: **skip Vault** — invoke the function directly with curl (see below).

---

### Auto-injected edge secrets (do not set manually in prod)

Supabase injects these at runtime:

```bash
SUPABASE_URL=https://<ref>.supabase.co          # or http://127.0.0.1:54321 locally
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...  # local demo key when using supabase start
```

Local demo service role (from `supabase start`):

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

---

## Local deployment

### 1. Prerequisites

- Docker + Supabase CLI
- Node 20+
- Admin user: `update public.users set is_admin = true where email = 'you@example.com';`
- `EXPO_PUBLIC_ADMIN_EMAIL=you@example.com` in root `.env` (UI hint only)

### 2. Configure edge function env

Copy and edit:

```bash
cp supabase/functions/.env.example supabase/functions/.env
```

Minimum for feed suggestions:

```bash
# supabase/functions/.env
GEMINI_API_KEY=AIzaSy...
CRON_INVOKER_SECRET=$(openssl rand -hex 32)   # or paste output of openssl rand -hex 32
GEMINI_FEED_MODEL=gemini-2.5-flash            # optional
AUTOPILOT_FEED_SUGGESTIONS_ENABLED=false
EXPO_PUBLIC_APP_URL=http://localhost:8081
```

### 3. Start Supabase + migrations

```bash
npx supabase start
npx supabase migration up --local
```

Confirm migrations applied:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20260702%';"
```

Expected: `20260702000000`, `20260702000001`, `20260702000002`.

### 4. Serve the edge function

```bash
npx supabase functions serve generate-feed-suggestions process-feed-suggestion-autopilot --env-file supabase/functions/.env
```

Or include it in your existing functions serve list.

**Local cron:** pg_cron in local Supabase may run, but Vault secrets are usually **not** configured locally. Prefer manual invoke (step 5).

### 5. Manual smoke test (local)

```bash
source supabase/functions/.env   # or export vars manually

curl -sS -X POST "http://127.0.0.1:54321/functions/v1/generate-feed-suggestions" \
  -H "Authorization: Bearer $CRON_INVOKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force": true, "slot": "08:00", "triggered_by": "manual"}' | jq .
```

Expected success:

```json
{
  "ok": true,
  "batchId": "...",
  "slot": "08:00",
  "runDate": "2026-06-24",
  "suggestionCount": 12
}
```

Re-run without `force` → `"skipped": true, "reason": "already_completed"`.

Verify DB:

```sql
select cron_slot, run_date, status, suggestion_count from feed_suggestion_batches order by started_at desc limit 3;
select category, horizon, autopilot_status, autopilot_score, question
from feed_market_suggestions
where status = 'pending'
limit 5;
```

### 5b. Autopilot dry-run smoke test

This should evaluate eligible rows without creating markets while `AUTOPILOT_FEED_SUGGESTIONS_ENABLED=false`.

```bash
curl -sS -X POST "http://127.0.0.1:54321/functions/v1/process-feed-suggestion-autopilot" \
  -H "Authorization: Bearer $CRON_INVOKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

Expected: `enabled: false`, plus `evaluated`, `created: []`, and `blocked` arrays.

### 6. App UI (local)

```bash
npm run web
```

Open feed as admin → **Feed Manager** → **Suggestions** tab (or `/(tabs)/feed?adminFeed=suggestions`).

---

## Production deployment

### Order of operations

| Step | Action |
|------|--------|
| 1 | Merge + deploy app (Admin UI) |
| 2 | `supabase db push` (or apply migrations `20260702000000`, `20260702000001`, `20260702000002`) |
| 3 | `supabase functions deploy generate-feed-suggestions` and `supabase functions deploy process-feed-suggestion-autopilot` |
| 4 | Set edge secrets (see below) |
| 5 | Create Vault secrets in Dashboard |
| 6 | Manual smoke test against prod URL |
| 7 | Wait for next top-of-hour UTC cron **and** ET slot (8/12/15) — or rely on hourly cron + slot gate |

### Edge secrets (production)

```bash
supabase secrets set GEMINI_API_KEY=AIzaSy...
supabase secrets set CRON_INVOKER_SECRET=$(openssl rand -hex 32)
# optional
supabase secrets set GEMINI_FEED_MODEL=gemini-2.5-flash
supabase secrets set AUTOPILOT_FEED_SUGGESTIONS_ENABLED=false
supabase secrets set AUTOPILOT_FEED_MAX_MARKETS_PER_RUN=1
supabase secrets set AUTOPILOT_FEED_MIN_SCORE=85
```

List secrets (names only):

```bash
supabase secrets list
```

### Vault secrets (production cron)

Dashboard: **Database → Vault → New secret**

Or SQL Editor:

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'project_url',
  'Supabase project URL for cron HTTP'
);

select vault.create_secret(
  'SAME_VALUE_AS_CRON_INVOKER_SECRET',
  'cron_invoker_secret',
  'Shared secret for pg_cron → edge function auth'
);
```

Migration `20260702000001` schedules hourly job `invoke-feed-suggestions-hourly`. If Vault is missing, cron logs a warning and skips the HTTP call.

### Production smoke test

```bash
curl -sS -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-feed-suggestions" \
  -H "Authorization: Bearer $CRON_INVOKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"force": true, "slot": "12:00", "triggered_by": "manual"}' | jq .
```

---

## Monitoring (production)

```sql
-- Did pg_cron fire?
select jobid, jobname, schedule, active from cron.job where jobname = 'invoke-feed-suggestions-hourly';

select status, return_message, start_time, end_time
from cron.job_run_details
order by start_time desc limit 10;

-- Did pg_net get a response?
select id, status_code, error_msg, created
from net._http_response
order by created desc limit 10;

-- Batch outcomes
select run_date, cron_slot, status, suggestion_count, error_message, started_at, completed_at
from feed_suggestion_batches
order by started_at desc limit 10;

-- Autopilot decisions
select category, autopilot_status, autopilot_score, autopilot_reasons, question
from feed_market_suggestions
order by created_at desc limit 20;
```

Edge function logs: Supabase Dashboard → Edge Functions → `generate-feed-suggestions` and `process-feed-suggestion-autopilot` → Logs.

---

## E2E tests

### Unit tests (no network, no keys)

```bash
npm run test:feed-suggestions
```

Runs `supabase/functions/_shared/gemini-feed-suggestions.test.ts` (slot mapping, JSON normalizer, prompt builder).

### API integration test (local Supabase, no Gemini by default)

```bash
# Requires: supabase start + migrations + admin user
npm run test:feed-suggestions-flow
```

Covers:

- Migrations `20260702000000` applied
- Service role can insert batch + suggestions
- Admin RPC `admin_dismiss_feed_suggestion` works
- RLS blocks anon reads

**Optional live Gemini call** (uses real API key + served function):

```bash
# Terminal 1
npx supabase functions serve generate-feed-suggestions --env-file supabase/functions/.env

# Terminal 2
RUN_FEED_SUGGESTIONS_GEMINI_TEST=1 npm run test:feed-suggestions-flow
```

Requires in `supabase/functions/.env`:

- `GEMINI_API_KEY`
- `CRON_INVOKER_SECRET`

### Playwright UI test (admin Suggestions tab)

Requires local stack running (Supabase + web + admin user):

```bash
npm run web   # terminal 1
npx playwright test feed-suggestions.spec.ts   # terminal 2, after admin-setup state exists
```

Or as part of extended E2E after `admin-setup`:

```bash
npx playwright test feed-suggestions.spec.ts --project=feed-suggestions
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `401 Unauthorized` on invoke | Wrong or missing `CRON_INVOKER_SECRET` | Match header `Bearer ...` to `supabase/functions/.env` / edge secret |
| `GEMINI_API_KEY is not set` | Secret not loaded | Add to `.env`, restart `functions serve`; prod: `supabase secrets set` |
| `outside_slot` response | Not 8/12/15 ET | Use `{"force": true, "slot": "08:00"}` for testing |
| `already_completed` | Batch exists for today + slot | Use `"force": true` to regenerate |
| Cron never generates | Vault not configured | Create `project_url` + `cron_invoker_secret` in Vault |
| Cron runs but no batch | pg_net 401/500 | Check `net._http_response`; verify Vault secret matches edge secret |
| Empty Suggestions tab | No batches or all dismissed/created | Run manual invoke; check `feed_market_suggestions` where `status = 'pending'` |
| Admin tab missing | Not admin | `update users set is_admin = true`; set `EXPO_PUBLIC_ADMIN_EMAIL` |
| Gemini API 403/429 | Key or quota | Enable Generative Language API; check AI Studio quotas |

---

## File map

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260702000000_feed_market_suggestions.sql` | Tables, RLS, admin RPCs |
| `supabase/migrations/20260702000001_schedule_feed_suggestion_cron.sql` | pg_cron + pg_net wrapper |
| `supabase/functions/generate-feed-suggestions/index.ts` | Edge function |
| `supabase/functions/_shared/gemini-feed-suggestions.ts` | Gemini client + prompt |
| `components/AdminFeedManager.tsx` | Suggestions tab UI |
| `services/feed.service.ts` | Client fetch/dismiss/mark |
| `scripts/test-feed-suggestions-flow.sh` | API E2E script |
| `tests/e2e/feed-suggestions.spec.ts` | Playwright admin UI test |
| `supabase/functions/.env.example` | Local secret template |
