# Notifications and email

Anymarkt delivers social and market notifications through three channels:

- **In-app inbox** — `notifications` table + realtime (`/notifications` screen)
- **Email** — Resend via Supabase Edge Functions
- **Web push** — Web Push API + service worker (`public/sw.js`), web only

## Contract-first transactional email

Live wallet bets **always** receive wager receipt emails:

| Event | Function | Attachment |
|-------|----------|------------|
| Bet placed | `send-bet-contract-email` (`placed`) | PDF + HTML receipt |
| Market settled (win or loss) | `dispatch-market-contract-emails` | PDF + HTML settlement receipt |

These are **required** compliance emails — not controlled by user notification toggles.

Generic `bet_won` / `bet_lost` notification emails are **suppressed** when a contract receipt exists for that market (settlement value lives in the contract email).

## Edge functions

| Function | Purpose |
|----------|---------|
| `dispatch-notification` | Sends email + web push for notification rows / dispatch queue |
| `send-bet-contract-email` | Wager agreement email with PDF/HTML attachment (placed or resolved) |
| `dispatch-market-contract-emails` | Batch settlement receipts after market resolve |
| `process-email-digest` | Cron: batch digest emails (daily/weekly) |
| `email-unsubscribe` | One-click unsubscribe landing (HTML) |
| `resend-webhook` | Bounce/complaint → auto-disable email prefs |
| `send-welcome-email` | Post-signup welcome email |
| `send-group-invite-email` | Email invite link for a group |
| `send-beta-approval-email` | Beta approval |
| `send-bet-contract-email` | Legal wager contracts (always sent) |
| `generate-feed-suggestions` | Cron: Gemini feed market suggestions (admin queue) |
| `generate-image` | Admin AI market images (Imagen) |

## Environment variables

Client (`.env`):

```bash
EXPO_PUBLIC_APP_URL=https://your-app.example.com
EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY=...   # VAPID public key (web push opt-in)
```

Edge functions (`supabase/functions/.env` or Supabase secrets):

```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Anymarkt <onboarding@yourdomain.com>
RESEND_WEBHOOK_SECRET=whsec_...
EMAIL_UNSUBSCRIBE_SECRET=...          # HMAC secret for one-click unsubscribe (defaults to service role key)
EXPO_PUBLIC_APP_URL=https://your-app.example.com
WEB_PUSH_PUBLIC_KEY=...
WEB_PUSH_PRIVATE_KEY=...
WEB_PUSH_SUBJECT=mailto:support@yourdomain.com
```

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

## Supabase Auth SMTP (Resend)

For branded password reset and confirmation emails, configure Resend SMTP in the Supabase dashboard:

1. Resend → Domains → verify your sending domain
2. Supabase → Project Settings → Auth → SMTP Settings
3. Host: `smtp.resend.com`, Port: `465`, User: `resend`, Password: your Resend API key

Forgot-password UI: `/login` → **Forgot password?**  
Reset landing route: `/auth/reset-password`

## Database

Migrations:

- `20260628160000_notification_preferences_social.sql` — base prefs + dispatch queue
- `20260701000000_email_smart_controls.sql` — decoupled dispatch, digests, unsubscribe tokens

Tables:

- `user_notification_preferences` — per-user toggles + smart controls (`email_frequency`, `email_skip_if_read`)
- `notification_deliveries` — email/push delivery audit
- `notification_dispatch_queue` — pending multi-channel dispatch (works without in-app row)
- `email_digest_queue` — batched digest items
- `email_unsubscribe_tokens` — one-click unsubscribe
- `web_push_subscriptions` — browser push endpoints

Triggers:

- New follow → `new_follower` notification
- Market resolved → `bet_won` / `bet_lost` / `market_resolved`
- `notify_user()` respects in-app prefs; email/push dispatch is independent

## Production dispatch

After a notification is inserted (or external-only dispatch enqueued), a row lands in `notification_dispatch_queue`.

**Recommended:** Database Webhook on `notification_dispatch_queue` INSERT → POST to `dispatch-notification` with service role bearer token.

**Digest cron:** Schedule hourly POST to `process-email-digest` with service role (sends daily at user's `email_digest_hour_utc`; weekly on Mondays).

**Resend webhooks:** Point `email.bounced` and `email.complained` to `resend-webhook`.

**Contract settlement:** Database Webhook on `bet_contracts` UPDATE when `resolved_snapshot` becomes non-null → `dispatch-market-contract-emails` with service role.

**Client fallback:** Realtime listener in `useNotifications` invokes `dispatch-notification` for the signed-in user when new rows arrive.

**After market resolve:** Client calls `dispatch-notification` with `{ marketId }` and `dispatch-market-contract-emails` with `{ marketId }`.

## User settings

Settings hub: `/settings/notifications`

- **Required wager receipts** — read-only notice (always on for live bets)
- **Email delivery** — immediate / daily digest / weekly digest
- **Skip email if already read** — defers email when in-app notification was read within 2h
- Category toggles: market results, social, group invites

Unsubscribe links in non-transactional emails → `/email/unsubscribe?token=...`

## Local testing

```bash
npx supabase start
npx supabase migration up --local
npm run test:social-stack
npx supabase functions serve --env-file supabase/functions/.env
```

Individual scripts:

```bash
npm run test:notification-sql
npm run test:notification-email
```

Auth emails locally: Mailpit at `http://127.0.0.1:54324` (see `docs/local-dev-verification.md`).

## Manual QA checklist

| Flow | Steps |
|------|-------|
| Contract placed | Live group bet → email with PDF/HTML attachment |
| Contract settled | Resolve market → one settlement email per bettor (no duplicate outcome email) |
| Channel independence | Disable in-app results → contract emails still arrive |
| Digest | Set daily digest → multiple followers → one batched email at digest hour |
| Skip if read | Read notification in app → email skipped within 2h |
| Unsubscribe | Click footer link → social emails disabled; contract emails still sent |
| Group invites | Toggle off group invites → no invite email for existing users |
