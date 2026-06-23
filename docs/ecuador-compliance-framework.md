# AnyMarket Ecuador Compliance Framework

This document is an engineering and policy framework for counsel/regulator review. It is not legal advice.

## Platform Thesis

AnyMarket is designed as a rules-based future-event market protocol:

- users create markets around future events;
- each market declares outcomes, close time, source of truth, and resolver model;
- value transfer is gated by policy acceptance, KYC, jurisdiction rules, provider eligibility, and market review state;
- settlement and payment activity produce audit evidence.

The product should not be presented as a traditional sportsbook. During Ecuador framework development, public discovery should exclude sports markets and other high-risk categories.

## Layered Model

1. Messaging layer: private rooms and public discovery for market creation and discussion.
2. Market governance layer: category rules, prohibited-market taxonomy, creator attestation, manual review, freeze/unfreeze.
3. Compliance layer: policy versions, user acceptance, KYC status, jurisdiction, limits, restrictions.
4. Payment layer: Stripe for fiat deposits/payout onboarding, MoonPay for crypto on/off-ramp flows.
5. Settlement layer: declared source, resolver action, evidence, dispute/review logs.
6. Accounting and AML layer: immutable ledger, provider webhooks, suspicious-activity signals, monthly exports.

## Ecuador Launch Posture

- No sports markets in the public feed.
- No public markets involving violence, death, individual health, national security, active court cases, or high-risk elections without legal review.
- Real-money users must accept current Terms, Privacy, Risk Disclosure, Market Rules, AML/KYC Policy, and Prohibited Markets Policy.
- Real-money activity requires verified KYC and an allowed jurisdiction profile.
- Stripe and MoonPay are provider rails, not regulatory shields.
- Crypto and fiat flows remain reconcilable in the ledger and can be disabled by jurisdiction, asset, network, or market category.

## Provider Responsibilities

Stripe can provide hosted fiat payment, Identity, and payout onboarding flows.

MoonPay can provide hosted crypto on/off-ramp flows and provider-side KYC/transaction status evidence.

AnyMarket remains responsible for:

- platform policy acceptance;
- market eligibility and prohibited-content controls;
- jurisdiction and user restrictions;
- accounting and tax evidence;
- AML monitoring signals and evidence export;
- settlement source and dispute logs.

## Server-Side Gate Standard

Every real-value action must pass a backend gate:

- current required policies accepted;
- KYC verified or allowed for the action;
- jurisdiction allowed;
- account not restricted or frozen;
- amount within exposure and velocity limits;
- provider allowed for user jurisdiction/action;
- crypto asset/network allowed when MoonPay is used;
- market category approved and not prohibited.

UI gates are informational. Backend gates are the source of truth.

## Evidence Package

For counsel or regulator review, export:

- policy versions and user acceptance records;
- user compliance profile history;
- KYC provider session references;
- Stripe payment/payout webhooks;
- MoonPay transaction webhooks;
- wallet ledger and market settlement records;
- market review/freeze decisions;
- suspicious activity signals;
- monthly tax/AML summary periods.

## Open Legal Questions

See [`ec-product-classification-memo.md`](./ec-product-classification-memo.md) for counsel decision tree. Summary:

- Whether non-sports future-event markets are outside Ecuador's sports-betting licensing regime.
- Whether private real-money event markets are treated as gaming, financial contracts, payment services, or another category.
- Whether wallet balances and crypto rails trigger fintech/payment authorization.
- Tax base, withholding, VAT/digital service treatment, and monthly reporting obligations — see [`ec-uafe-sri-compliance-runbook.md`](./ec-uafe-sri-compliance-runbook.md).
- Whether UAFE registration and formal suspicious transaction reporting are required before launch — see runbook.
- Whether local Ecuadorian entity or representative is required — see [`ec-local-presence-requirements.md`](./ec-local-presence-requirements.md).

## Engineering and deploy docs

| Doc | Purpose |
|-----|---------|
| [ec-beta-e2e-checklist.md](./ec-beta-e2e-checklist.md) | Manual QA before beta invites |
| [ec-counsel-launch-checklist.md](./ec-counsel-launch-checklist.md) | Counsel sign-off gate |
| [deploy-beta-approval-notify.md](./deploy-beta-approval-notify.md) | Beta request → approve → email flow |
| [multi-jurisdiction-compliance.md](./multi-jurisdiction-compliance.md) | Residence → jurisdiction → policy pack |
| [local-dev-verification.md](./local-dev-verification.md) | Local setup and test gates |
