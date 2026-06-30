# Gemini feed market suggestions (cron)

Admin-only AI market ideas at **8am, 12pm, and 3pm US Eastern**.

**Full runbook (local + production deploy, env vars, E2E):** [feed-suggestions-runbook.md](./feed-suggestions-runbook.md)

## Quick links

| Task | Command / doc |
|------|----------------|
| Local smoke test | Runbook § Local deployment → step 5 |
| Production deploy | Runbook § Production deployment |
| Env var reference | Runbook § Environment variables reference |
| API E2E test | `npm run test:feed-suggestions-flow` |
| Live Gemini E2E | `RUN_FEED_SUGGESTIONS_GEMINI_TEST=1 npm run test:feed-suggestions-flow` |
| Unit tests | `npm run test:feed-suggestions` |
| Playwright UI | `npx playwright test feed-suggestions.spec.ts --project=feed-suggestions` |
| Autopilot dry run | POST `process-feed-suggestion-autopilot` with `AUTOPILOT_FEED_SUGGESTIONS_ENABLED=false` |
