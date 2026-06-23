# Deploy: Bet contract email pipeline

Resend emails for wallet-tied wager agreements on live private group bets.

## Functions

| Function | Auth | Purpose |
|----------|------|---------|
| `send-bet-contract-email` | User (own contract) or service role | Send placed/resolved email for one contract |
| `dispatch-market-contract-emails` | Market resolver/admin or service role | Send resolved emails for all contracts on a market |

## Secrets

Same as beta approval (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `EXPO_PUBLIC_APP_URL`).

## Flow

1. User places live bet in private group → `place_bet` → `bet_contracts` trigger → client invokes `send-bet-contract-email` (`placed`)
2. Market resolves → `update_bet_contracts_on_resolution` trigger → resolver client invokes `dispatch-market-contract-emails`

Optional: configure a Supabase Database Webhook on `bet_contracts` UPDATE when `resolved_snapshot` becomes non-null to invoke `dispatch-market-contract-emails` with service role for fully automatic delivery.

## Deploy

```bash
supabase functions deploy send-bet-contract-email
supabase functions deploy dispatch-market-contract-emails
supabase db push
```

## Verification

1. Place a live group bet with a verified user
2. Open `/contract/{betId}` — confirm snapshot, PDF, email resend
3. Resolve market — confirm settlement block and resolved email
