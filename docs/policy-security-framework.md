# Anymarkt Policy, Ontology & Security Framework

Engineering reference for the four-primitive model: **Actor**, **Context**, **Action**, **Evidence**.

## North star

Anymarkt is **social prediction infrastructure**:

- **Practice first** — trial credits, no real money
- **Live when verified** — residence, policy pack, age attestation, KYC, backend gates
- **Objective markets** — outcomes, close time, resolver, source of truth
- **Harm prohibition** — taxonomy, detection, review, server denial

UI gates are informational. **Postgres RPCs + `assert_compliance_gate` are authoritative.**

## Four primitives

| Primitive | Examples |
|-----------|----------|
| Actor | user, admin (`is_app_admin`), system (service role), provider webhook |
| Context | jurisdiction, locale, practice/live, group/public surface, category |
| Action | `live_position`, `stripe_deposit`, `create_market`, `resolve_market` |
| Evidence | policy hash + acceptance, wallet ledger, bet contract, compliance event |

## Database objects

| Object | Migration |
|--------|-----------|
| Security boundary | `20260627120000_security_boundary_hardening.sql` |
| Policy ontology | `20260627130000_policy_ontology_unification.sql` |
| Gate matrix | `20260627140000_gate_actions_matrix.sql` |
| Bet contracts | `20260627150000_bet_contracts_evidence.sql` |

### Policy packs

- `policy_versions.locale` — `en` or `es`
- Unique active required row per `(jurisdiction, locale, kind)`
- `get_user_policy_locale()` derives locale from residence country
- `has_current_policy_acceptances()` is locale-aware

### Category mapping

- `market_category_mappings` maps display slugs → compliance category slugs
- `get_compliance_config()` returns framework rules, mappings, and required policies

### Gate matrix

- `gate_actions` table drives `assert_compliance_gate`
- Live actions require policy pack, age attestation, KYC, and live wallet where applicable

### Bet contracts

- Auto-created for live private group bets
- Wallet-tied snapshot with group participants and accepted policies
- Resolution snapshot on market settle
- Emails via Resend (`send-bet-contract-email`, `dispatch-market-contract-emails`)

## Client surfaces

| Surface | Path |
|---------|------|
| Wager agreement | `/contract/[betId]` |
| How it works | `/how-it-works` |
| Compliance config | `complianceService.getComplianceConfig()` |
| Gate action constants | `lib/compliance/gate-actions.ts` |

## Security regression tests

```bash
# Requires local Supabase + pgTAP
psql "$DATABASE_URL" -f supabase/tests/security_boundary_hardening.sql
```

## Error monitoring (Sentry)

Client errors and structured logs are sent to Sentry when `EXPO_PUBLIC_SENTRY_DSN` is configured. PII (email, phone, tokens) is scrubbed in `beforeSend`. Session replay masks all text inputs. Edge functions optionally forward ERROR-level logs when `SENTRY_DSN` is set in Supabase secrets. See [ui-system.md](./ui-system.md).

## Related docs

- [ui-system.md](./ui-system.md) — design tokens, primitives, a11y, motion, Sentry logging rules
- [multi-jurisdiction-compliance.md](./multi-jurisdiction-compliance.md)
- [ecuador-compliance-framework.md](./ecuador-compliance-framework.md)
- [deploy-bet-contract-email.md](./deploy-bet-contract-email.md)
