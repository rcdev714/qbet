# Notifications and email

AnyMarket delivers social and market notifications through three channels:

- **In-app inbox** — `notifications` table + realtime (`/notifications` screen)
- **Email** — Resend via Supabase Edge Functions
- **Web push** — Web Push API + service worker (`public/sw.js`), web only

## Edge functions

| Function | Purpose |
|----------|---------|
| `dispatch-notification` | Sends email + web push for in-app notification rows |
| `send-welcome-email` | Post-signup welcome email |
| `send-group-invite-email` | Email invite link for a group |
| `send-beta-approval-email` | Beta approval (existing) |
| `send-bet-contract-email` | Legal wager contracts (existing, always sent) |

## Environment variables

Client (`.env`):

```bash
EXPO_PUBLIC_APP_URL=https://your-app.example.com
EXPO_PUBLIC_WEB_PUSH_PUBLIC_KEY=...   # VAPID public key (web push opt-in)
```

Edge functions (`supabase/functions/.env` or Supabase secrets):

```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=AnyMarket <onboarding@yourdomain.com>
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

Migration: `20260628120000_notification_preferences_social.sql`

- `user_notification_preferences` — per-user toggles
- `notification_deliveries` — email/push delivery audit
- `web_push_subscriptions` — browser push endpoints
- `notification_dispatch_queue` — pending multi-channel dispatch

Triggers:

- New follow → `new_follower` notification
- Market resolved → `bet_won` / `bet_lost` / `market_resolved`
- `notify_user()` respects in-app preference flags

## Production dispatch

After a notification is inserted, enqueue a row in `notification_dispatch_queue`.

**Recommended:** Database Webhook on `notification_dispatch_queue` INSERT → POST to `dispatch-notification` with service role bearer token.

**Client fallback:** Realtime listener in `useNotifications` invokes `dispatch-notification` for the signed-in user when new rows arrive.

**After market resolve:** Client calls `dispatch-notification` with `{ marketId }` to fan out emails for all bettors on that market.

## User settings

Settings hub: `/settings` — account, profile status, notifications, groups, appearance, privacy & legal.

The legacy `/(tabs)/settings` tab route redirects to `/settings`.

Notifications inbox filters: **All | Results | Social | Groups** at `/notifications` (accessible filter chips, 44pt targets).

Following timeline: **Markets | Following** tabs on the feed; activity RPC `get_following_activity_v2`.

Group invites create in-app `group_invite` rows when the invitee already has an account (via `send-group-invite-email`).

## Local testing

```bash
npx supabase start
npx supabase migration up --local
npm run test:social-stack   # SQL integration + notification email templates
npx supabase functions serve --env-file supabase/functions/.env
```

Individual scripts:

```bash
npm run test:notification-sql
npm run test:notification-email
```

Auth emails locally: Mailpit at `http://127.0.0.1:54324` (see `docs/local-dev-verification.md`).

### Manual QA checklist (post-migration)

| Flow | Steps |
|------|-------|
| Settings hub | Profile gear → `/settings` → each sub-screen (account, notifications, groups, appearance, privacy) |
| Feed tabs | Markets ↔ Following on mobile + web; pull-to-refresh on Following |
| Notifications | All / Results / Social / Groups filters + empty states; chip tab semantics |
| Profile groups | Groups tab; Join on another user's discoverable group |
| Activity row | Bet, comment, group events navigate correctly; Join CTA is separate from row tap |
| Notification prefs | Push / Email / In-app channel sections in `/settings/notifications` |
