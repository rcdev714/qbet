import { APP_URL } from "../brand";
import type { ComplianceJurisdiction } from "../compliance/jurisdiction";
import type { PolicyDocument, PolicySection } from "./policy-content";

const LAST_UPDATED = "July 1, 2026";
const VERSION = "2026-07-01-platform-integrity";

function buildSections(): PolicySection[] {
  return [
    {
      heading: "1. Overview",
      paragraphs: [
        "Anymarkt is built on a multi-layer integrity, security, and fraud-prevention program. Over years of development we have invested substantial engineering, operational, and compliance resources into systems that protect users, settlements, wallets, and market outcomes.",
        "This page describes — in plain language — how those systems work at a high level. It supplements our Terms of Service, Market Rules, AML/KYC Policy, Privacy Policy, and Private Group Settlement & Review disclosure. We do not publish confidential detection models, security-sensitive thresholds, or investigation playbooks that could be abused to evade controls.",
      ],
    },
    {
      heading: "2. Anymarkt Fraud Detection Engine",
      paragraphs: [
        "At the core of our platform is a proprietary fraud detection and risk engine that continuously evaluates accounts, devices, networks, markets, transactions, settlements, and social activity. The engine combines automated signals, provider checks, and human review queues.",
      ],
      bullets: [
        "Identity and eligibility signals: age attestation, residence gates, KYC outcomes, sanctions and restricted-person screening, and payment-instrument verification through regulated providers.",
        "Account and device integrity: multi-accounting detection, credential compromise indicators, suspicious login patterns, emulator or automation signals, and velocity limits on deposits, withdrawals, bets, and transfers.",
        "Market and trading integrity: collusion patterns, wash or circular activity, coordinated betting, insider-style timing, bot abuse, artificial liquidity, and manipulation attempts around close or settlement.",
        "Payment and wallet fraud: stolen-card indicators, chargeback risk, refund abuse, sanctions evasion patterns, structuring, and inconsistent funding sources.",
        "Settlement and rating abuse: coordinated unfair-rating campaigns, repeated bad-faith disputes, resolver coercion, and attempts to trigger automated reopening without genuine participation.",
        "Content and safety signals: reports, blocks, moderation history, harassment, threats, and prohibited-market indicators integrated with trust scoring.",
        "Escalation outcomes: warnings, holds, market freezes, settlement delays, voids, corrections, wallet restrictions, account suspension, evidence preservation, and referral to payment partners or authorities where required.",
      ],
    },
    {
      heading: "3. Secure Settlement Infrastructure",
      paragraphs: [
        "Settlements — whether resolved by a group administrator, creator, or platform process — are supported by auditable records, policy checks, and integrity controls.",
      ],
      bullets: [
        "Markets must publish objective outcomes, close times, resolution sources, and settlement rules before participation where supported.",
        "Settlement actions, evidence uploads, disputes, corrections, and overrides are logged for review, regulatory, and fraud-prevention purposes.",
        "For Live wallet markets, payouts may be temporarily held during settlement review. Private group live winnings show as Incoming in your wallet for up to 72 hours after settlement and are not spendable until released. Corrections follow applicable payment, compliance, and provider rules.",
        "Anymarkt may freeze, void, or correct settlements when fraud, manipulation, technical error, legal obligation, or safety concerns are identified — regardless of group-admin or member actions.",
        "Resolver and administrator activity may be scored over time using member feedback and automated integrity signals.",
      ],
    },
    {
      heading: "4. Algorithmic Settlement Review (Private Groups)",
      paragraphs: [
        `Private group predictions use an automated settlement-review process after members who bet on a market share feedback. This process is designed to distinguish genuine concern from casual or mistaken reactions. Full details are in our Private Group Settlement & Review disclosure (${APP_URL}/group-settlements).`,
        "At a high level, the system:",
      ],
      bullets: [
        "Accepts only feedback from members who actually placed a bet on the prediction.",
        "Uses asymmetric friction: positive feedback is simple; raising a serious concern requires a written explanation.",
        "Requires meaningful participation before any automated review is considered — small groups need stronger agreement than large groups.",
        "Applies statistical confidence checks so a handful of ratings cannot automatically reopen a market without sufficient evidence of widespread concern.",
        "Discounts or blocks coordinated or bad-faith rating patterns detected by our fraud and collusion systems.",
        "May place a prediction under review, allow evidence submission during a waiting period, and only then permit reopening for correction — reopening does not guarantee any particular outcome.",
      ],
    },
    {
      heading: "5. Online Support and Escalation",
      paragraphs: [
        "Users can reach Anymarkt through in-app help, email support, and structured reporting flows. Serious matters may be escalated for urgent review.",
      ],
      bullets: [
        "General help: in-app menus, policy pages, and email support for account, market, and wallet questions.",
        "Settlement feedback: optional post-settlement prompts for eligible bettors in private groups, with a dedicated disclosure page explaining how feedback works.",
        "Disputes and reports: in-app forms to dispute outcomes or report administrator misconduct, harassment, fraud, or manipulation.",
        "Urgent escalation: attested urgent reports for serious misconduct, safety threats, or fraud that may receive prioritized human review.",
        "Platform override: Anymarkt staff may intervene independently of group processes for legal, compliance, fraud, or safety reasons.",
        "We may request additional evidence, temporarily restrict activity while investigating, and communicate outcomes according to policy and applicable law.",
      ],
    },
    {
      heading: "6. Human Review and Platform Override",
      paragraphs: [
        "Automated systems reduce risk and scale review, but they do not replace human judgment for serious cases. Anymarkt maintains administrator and trust-and-safety workflows to investigate disputes, fraud alerts, content reports, payment anomalies, and settlement conflicts.",
        "Platform decisions on freeze, void, correction, account restriction, or fund holds are final where permitted by applicable law and provider rules.",
      ],
    },
    {
      heading: "7. Records, Audits, and Cooperation",
      bullets: [
        "We retain settlement evidence, ratings, disputes, wallet ledger entries, compliance events, moderation actions, and support communications as described in our Privacy Policy and Market Rules.",
        "Records may be used for chargeback defense, AML/KYC obligations, regulatory reporting, fraud prevention, litigation, and audit purposes.",
        "We may cooperate with payment partners, regulators, courts, and law enforcement when legally required or reasonably necessary to protect users and platform integrity.",
      ],
    },
    {
      heading: "8. Important Limitations",
      paragraphs: [
        "No fraud-prevention or integrity system can stop every attempted abuse. Users remain responsible for reviewing market terms, resolver duties, and risks before participating.",
        "Automated settlement review in private groups is a safeguard — not a majority vote to reverse results automatically. It works alongside — not instead of — our fraud detection engine, support channels, and platform override authority.",
        "We may update detection methods, review thresholds, and operational procedures as threats, law, and product capabilities evolve. Material policy changes will be reflected in our published policies.",
      ],
    },
  ];
}

export function getPlatformIntegrityDisclosureDocument(
  jurisdiction: ComplianceJurisdiction = "US",
): PolicyDocument {
  return {
    kind: "market_rules",
    jurisdiction,
    version: VERSION,
    title: "Platform Integrity, Fraud Detection & Settlement Security",
    route: "/platform-integrity",
    lastUpdated: LAST_UPDATED,
    seoDescription:
      "How Anymarkt's fraud detection engine, secure settlement infrastructure, algorithmic review, and support systems protect users and market integrity.",
    sections: buildSections(),
  };
}

/** Short copy for in-app trust notices. */
export const PLATFORM_INTEGRITY_NOTICE = {
  summary:
    "Anymarkt uses proprietary fraud detection, secure settlement controls, and automated review systems — backed by human support — to protect users and market integrity.",
  linkLabel: "Platform integrity & fraud prevention",
  settlementLinkLabel: "How group settlement review works",
} as const;
