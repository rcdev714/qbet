# Ecuador Product Classification Memo (Counsel Draft)

**Status:** Engineering draft for Ecuador counsel review — **not legal advice or a regulatory determination.**

**Product:** AnyMarket — user-generated future-event prediction markets with Play Mode (virtual) and Live wallet (real funds).

**Primary licensing jurisdiction:** Republic of Ecuador (services offered to Ecuador-resident users).

---

## 1. Executive summary

### Product position (confirmed — pending counsel sign-off)

AnyMarket is **not** an *operador de pronósticos deportivos* and is **not pursuing** a **LOPD** licence from Ministerio del Deporte. The product is designed and enforced as a **non-sports, user-generated future-event prediction market platform** for Ecuador-resident users.

**Engineering evidence of this posture:**
- No sports category in public feed for EC users
- Server-side category blocks (`ec_sports_market_blocked`) and **content-based** sports detection (`ec_sports_content_detected`) for EC jurisdiction
- Automated scan of market question, description, options, and resolution source text
- Prohibited-markets policy and Spanish EC legal pack disclaim sportsbook operator status

Counsel must still confirm this classification in writing before public real-money launch.

| Question | Product / engineering position | Counsel determination | Notes |
|----------|-------------------------------|----------------------|-------|
| Is AnyMarket an *operador de pronósticos deportivos* under Ecuador law? | **No — out of scope by design** | _Pending sign-off_ | Non-sports UGC markets only; sports content blocked for EC |
| Is a **LOPD** licence required before real-money EC launch? | **No — not pursuing LOPD** | _Pending sign-off_ | See Section 3 |
| Are wallet / parimutuel flows **payment services** or **stored value** requiring separate authorization? | _Pending_ | — | See Section 4 |
| Is activity **gaming/luck-based** under Ecuador gaming law? | _Pending_ | — | See Section 5 |
| Can AnyMarket launch with **no sector licence** subject to conditions? | _Pending_ | — | Requires written opinion + monitoring triggers |

**Recommended product posture (engineering):** Non-sports, user-generated future-event markets; no public sports discovery; server-side EC sports blocks; UAFE-ready AML; full ledger exports.

---

## 2. Activity map (features → legal characterization)

| Feature | Product behavior | Funds flow | Counsel classification (fill in) |
|---------|------------------|------------|----------------------------------|
| Play Mode | Virtual credits, no redemption | None | _Entertainment / not gambling?_ |
| Live wallet deposit | Stripe Connect / MoonPay | User → platform rail | _Payment service? Deposit?_ |
| Live position (bet) | Parimutuel pool on approved market | User wallet → market pool | _Wager / contract / gaming?_ |
| Market settlement | Resolver + source of truth | Pool → winners | _Prize / consideration?_ |
| Withdrawal | Stripe / crypto payout | Platform rail → user | _Payment service?_ |
| User-to-user transfer | Wallet transfer between users | User → user | _Payment / remittance?_ |
| UGC market creation | Creator defines event/outcomes | None until bets | _Operator offering markets?_ |
| Public feed | Discovery of public markets | N/A | _Marketing / offering?_ |

Reference implementation gates: `assert_compliance_gate`, `upsert_market_compliance_review`, [`lib/compliance/policy.ts`](../lib/compliance/policy.ts).

---

## 3. Sports betting / LOPD analysis

### 3.1 Legal framework (public sources — verify with counsel)

- **LOPD:** Licencia para Operación de Pronósticos Deportivos — sole enabling title for *pronósticos deportivos* (Decreto Ejecutivo 487, 2024; Reglamento General a la Ley Orgánica del Deporte, published June 2026).
- **Competent authority:** Ministerio del Deporte (ente rector del deporte).
- **Scope (typical):** Predictions on **sporting events or facts linked to sporting events**.
- **Parallel obligations for licensed operators:** UAFE registration, platform certification, prize withholding (~15%), high annual licence cost (~655 SBU).

### 3.2 AnyMarket differentiation arguments (counsel to validate)

| Argument | Engineering support | Counter-risk |
|----------|---------------------|--------------|
| Product is **not sports betting** — non-sports future events only | EC `publicSportsMarketsAllowed: false`; server gate `ec_sports_market_blocked` | Private sports markets, sports-adjacent wording, regulator broad interpretation |
| **UGC protocol** not house book | Creator-defined markets, parimutuel not fixed odds | Operator still facilitates wagers |
| **No public sports discovery** | Feed filter + DB gates | Direct links, group invites, search |
| Not marketed as sportsbook | EC policy copy, disclaimers | Marketing materials, app store metadata |

### 3.3 Counsel decision tree

```
Does the platform accept predictions on sporting events (any channel)?
├─ YES → LOPD licence likely required (Ministerio del Deporte)
└─ NO → Is real-money prediction on future events still "gaming" or "betting"?
    ├─ YES → Identify applicable gaming/contract/payment regime
    └─ NO → Document no-licence opinion with conditions and monitoring triggers
```

### 3.4 Sign-off

- [ ] Written opinion: AnyMarket EC launch **does / does not** require LOPD
- [ ] If not LOPD: list **conditions** (categories, channels, volume caps, copy restrictions)
- [ ] **Monitoring triggers** that would re-open classification (e.g., sports leakage, regulatory inquiry)

**Counsel signature / date:** _______________

---

## 4. Payment services / fintech analysis

Questions for counsel:

1. Does holding user wallet balances (USD) before bet/settlement constitute **captación** or **payment services**?
2. Does Stripe Connect Express (user-connected accounts) change characterization vs platform custody?
3. Do MoonPay crypto on/off-ramps require separate authorization or provider reliance is sufficient?
4. Are user-to-user wallet transfers **remittances** under Ecuador law?

**Engineering controls:** Provider allowlists per jurisdiction, ledger reconciliation, ability to disable rails by jurisdiction ([`compliance_jurisdiction_rules`](../supabase/migrations/20260514001000_compliance_framework.sql)).

**Counsel conclusion:** _______________

---

## 5. Gaming / luck-based activity analysis

Questions for counsel:

1. Are parimutuel future-event markets **contracts**, **games of chance**, or **skill-based** under Ecuador civil/commercial law?
2. Does house fee / vig affect classification?
3. Does Play Mode create regulatory risk if Live wallet is available in same app?

**Counsel conclusion:** _______________

---

## 6. Parallel Ecuador obligations (likely regardless of LOPD)

| Regime | Authority | Engineering posture | Counsel confirm |
|--------|-----------|---------------------|-----------------|
| AML/CFT | UAFE | KYC, monitoring, SAR-ready exports | See [`ec-uafe-sri-compliance-runbook.md`](./ec-uafe-sri-compliance-runbook.md) |
| Data protection | SPDP / LOPDP | EC privacy pack, minimization, rights | Spanish policies in app |
| Tax | SRI | Ledger exports, withholding analysis | See UAFE/SRI runbook |
| Consumer protection | — | Risk disclosure, prohibited markets | EC policy pack |
| Advertising | — | No sportsbook positioning | Marketing review |

---

## 7. Evidence package for classification review

Export for counsel session:

1. This memo (completed Sections 3–5)
2. [`docs/ecuador-compliance-framework.md`](./ecuador-compliance-framework.md)
3. EC Spanish policy pack (`lib/legal/policy-content-es-ec.ts`) + `policy_versions` hashes
4. Sample `compliance_events` for gate denials (`ec_sports_market_blocked`)
5. Market taxonomy (`prohibited_market_categories`)
6. Sample ledger + `prepare_regulatory_report_period` output

---

## 8. Revision log

| Date | Author | Change |
|------|--------|--------|
| 2026-06-22 | Engineering | Initial counsel draft template |
