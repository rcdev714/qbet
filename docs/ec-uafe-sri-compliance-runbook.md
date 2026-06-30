# Ecuador UAFE & SRI Compliance Runbook

**Status:** Engineering and operations runbook for counsel validation — **not legal advice.**

**Scope:** Anymarkt users with `country_of_residence = EC` and Live wallet activity.

**Related:** [`ec-product-classification-memo.md`](./ec-product-classification-memo.md), [`ecuador-compliance-framework.md`](./ecuador-compliance-framework.md)

---

## 1. UAFE (Unidad de Análisis Financiero y Económico)

### 1.1 When UAFE matters

UAFE is Ecuador’s financial intelligence unit. Obligations may attach if Anymarkt is classified as:

- a licensed **pronósticos deportivos** operator (explicit UAFE registration under 2026 regulation), or
- a **reporting entity** under Ecuador AML law for payment/wallet activity (counsel to confirm for non-LOPD classification).

**Blocking counsel item:** Confirm whether UAFE registration is required **before** public real-money EC beta.

### 1.2 Pre-launch checklist (counsel + ops)

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | Confirm reporting entity status with Ecuador counsel | Legal | _Pending_ |
| 2 | If required: submit UAFE registration / enrollment | Legal + Ops | _Pending_ |
| 3 | Appoint **Compliance Officer** (name, contact, backup) | Legal | _Pending_ |
| 4 | Adopt written **AML/CFT program** (Spanish) aligned with EC policy pack | Legal | _Pending_ |
| 5 | Configure **sanctions screening** (OFAC + local lists as advised) | Engineering | Stripe Identity + internal flags |
| 6 | Define **SAR escalation workflow** (Section 2) | Legal + Ops | _Pending_ |
| 7 | Train support/admin on SAR triggers and evidence preservation | Ops | _Pending_ |
| 8 | Verify ledger export covers UAFE review fields | Engineering | `accounting_ledger_entries`, `compliance_events` |

### 1.3 Ongoing monitoring signals (engineering)

Server and ops should monitor:

- Velocity limits exceeded (`assert_compliance_gate` denials)
- KYC `requires_review` / `rejected` spikes
- Multiple accounts / device clustering (manual review)
- Chargebacks and payout failures
- Crypto rail anomalies (MoonPay webhooks)
- Sports category leakage (`ec_sports_market_blocked` events)
- Restricted/prohibited market creation attempts
- Large single-market exposure

Log source: `compliance_events`, `suspicious_activity_signals` (if populated), Stripe/MoonPay webhooks.

### 1.4 Record retention

Preserve for counsel/regulator requests (minimum — counsel to set legal retention period):

- KYC session references (`kyc_verification_sessions`)
- Policy acceptances (`user_policy_acceptances`)
- Wallet ledger (`accounting_ledger_entries`)
- Gate decisions (`compliance_events`)
- Market review decisions (`market_compliance_reviews`)

---

## 2. SAR / ROS escalation workflow (draft)

**Counsel must approve** before production use.

### 2.1 Internal escalation tiers

| Tier | Trigger examples | Action | SLA |
|------|------------------|--------|-----|
| **L1 — Review** | Unusual velocity, failed KYC patterns, user reports | Compliance admin review; document in ticket | 24h |
| **L2 — Enhanced review** | Structuring patterns, sanctions near-miss, large unexplained flows | Freeze wallet if needed; preserve evidence | 48h |
| **L3 — Counsel** | Potential reportable activity | Legal review; draft ROS if advised | 72h |
| **L4 — File** | Counsel determines reportable | Submit to UAFE per legal instruction | As required by law |

### 2.2 ROS draft packet (internal)

When escalating to counsel, attach:

1. User ID, residence, KYC status snapshot
2. Timeline of wallet transactions (deposits, bets, withdrawals, transfers)
3. Related `compliance_events` and gate denials
4. Provider references (Stripe session IDs, MoonPay transaction IDs)
5. Market IDs and categories involved
6. Internal investigator notes (no conclusory legal labels)

### 2.3 Contacts

- Platform support: support@anymarkt.com
- Compliance escalation: _[appoint internal alias]_
- Ecuador counsel: _[firm / contact]_

---

## 3. SRI (Servicio de Rentas Internas) — tax obligations

### 3.1 Questions for counsel (blocking)

| # | Question | Notes |
|---|----------|-------|
| 1 | Is Anymarkt subject to **Impuesto a la Renta Único (15%)** as a prediction-market operator? | Sports-betting regime uses IRU; confirm if non-LOPD path differs |
| 2 | Must Anymarkt **withhold on user prizes/winnings** (~15% under sports regulation)? | Parimutuel payouts may trigger withholding |
| 3 | **VAT / digital services** on platform fees or spreads? | Monthly reporting obligations |
| 4 | **RUC / tax registration** requirements for foreign operator vs local entity | See [`ec-local-presence-requirements.md`](./ec-local-presence-requirements.md) |
| 5 | Monthly / periodic **information returns** to SRI? | Engineering: `regulatory_report_periods`, `prepare_regulatory_report_period` |

### 3.2 Engineering tax evidence

Monthly regulatory export (EC jurisdiction):

```sql
-- Example: prepare period (run in staging/prod with service role)
select public.prepare_regulatory_report_period(
  'EC',
  date '2026-06-01',
  date '2026-06-30'
);
```

Export includes ledger totals in `regulatory_report_periods.totals` — counsel to map fields to SRI forms.

### 3.3 Operational checklist

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | Tax classification memo from counsel | Legal | _Pending_ |
| 2 | Register / obtain RUC if required | Legal + Finance | _Pending_ |
| 3 | Configure withholding logic if required | Engineering + Finance | _Pending_ |
| 4 | Monthly close process using ledger exports | Finance + Ops | _Pending_ |
| 5 | Document invoice / fee treatment for platform vig | Finance | _Pending_ |

---

## 4. Integration with product gates

Real-money actions must pass `assert_compliance_gate`:

- Policy acceptances current for user's jurisdiction
- KYC verified
- Jurisdiction allowed
- Market approved and not prohibited
- **EC:** sports markets blocked (`ec_sports_market_blocked`)

See migration `20260623140000_ec_sports_gate_and_spanish_policies.sql`.

---

## 5. Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Ecuador counsel | | | [ ] |
| Compliance officer | | | [ ] |
| Engineering lead | | | [ ] |

---

## Related docs

- [ec-counsel-launch-checklist.md](./ec-counsel-launch-checklist.md) — master counsel gate
- [ec-product-classification-memo.md](./ec-product-classification-memo.md) — product classification
- [ec-local-presence-requirements.md](./ec-local-presence-requirements.md) — entity matrix
- [ec-beta-e2e-checklist.md](./ec-beta-e2e-checklist.md) — compliance gate QA
