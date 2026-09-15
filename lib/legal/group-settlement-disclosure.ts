import { APP_URL } from "../brand";
import type { ComplianceJurisdiction } from "../compliance/jurisdiction";
import type { PolicyDocument, PolicySection } from "./policy-content";

const LAST_UPDATED = "July 1, 2026";
const VERSION = "2026-07-01-group-settlements-v2";

function buildSections(): PolicySection[] {
  return [
    {
      heading: "1. Overview",
      paragraphs: [
        "Private group predictions are settled by group administrators (or designated resolvers) based on published criteria, close times, and evidence. After settlement, members who placed bets may optionally share feedback on whether the settlement process felt fair.",
        "Anymarkt protects this process with secure settlement records, a proprietary fraud detection engine, algorithmic review safeguards, and human support escalation. This page explains member feedback and automated review in private groups. For the full platform integrity program, see our Platform Integrity, Fraud Detection & Settlement Security disclosure.",
      ],
    },
    {
      heading: "2. Member feedback after settlement",
      bullets: [
        "Only members who placed a bet on a prediction may submit settlement feedback.",
        "Feedback is optional. You may skip, say you are not sure, confirm the settlement seemed fair with one tap, or — if something felt wrong — explain your concern in writing before submitting a formal negative signal.",
        "Negative feedback requires a short written explanation. This reduces mistaken or emotional reactions and helps distinguish genuine settlement issues from disappointment about losing a bet.",
        "Feedback helps the community and Anymarkt assess resolver quality over time.",
        "Feedback is an integrity safeguard — not a majority vote to automatically reverse results.",
      ],
    },
    {
      heading: "3. Algorithmic settlement review and reopening",
      paragraphs: [
        "When enough eligible bettors participate, Anymarkt applies an automated statistical review to determine whether serious, consistent concern exists. The system is designed to avoid reopening markets based on a few casual clicks.",
      ],
      bullets: [
        "Participation gates: review requires a minimum share of bettors to weigh in; small groups need stronger agreement than larger groups.",
        "Confidence checks: the system uses statistical methods to estimate whether observed concern likely reflects a genuinely unfair settlement rate, not random noise.",
        "Asymmetric input: one-tap positive feedback is accepted; negative signals require a written explanation meeting minimum length.",
        "Collusion and fraud controls: coordinated or bad-faith rating patterns may be discounted, blocked, or referred for manual review through Anymarkt's fraud detection engine.",
        "If thresholds are met, the prediction may enter an under-review period during which the resolver may provide additional evidence.",
        "After the waiting period, a prediction may be reopened for correction. Reopening does not guarantee any particular outcome.",
        "Anymarkt may override or bypass this process for legal, compliance, fraud, or safety reasons.",
      ],
    },
    {
      heading: "4. Fraud detection and settlement security",
      paragraphs: [
        `Anymarkt has invested substantial resources in a proprietary fraud detection and integrity engine that monitors accounts, markets, settlements, ratings, wallets, and reports. That engine works alongside — not instead of — this member feedback process. See ${APP_URL}/platform-integrity for a full overview.`,
      ],
      bullets: [
        "Settlement actions, evidence, disputes, ratings, and overrides are logged for audit, regulatory, and fraud-prevention purposes.",
        "Suspicious resolver behavior, rating campaigns, payment anomalies, or collusion may trigger holds, manual review, or platform override.",
        "Live wallet payouts may be temporarily held during settlement review or fraud investigation.",
      ],
    },
    {
      heading: "5. Live wallet markets",
      paragraphs: [
        "For real-money private group predictions, the admin's settlement is visible immediately, but winnings are not added to your spendable balance right away.",
      ],
      bullets: [
        "After settlement, live winnings enter a pending state for up to 72 hours while optional member feedback and integrity checks can run.",
        "Your wallet shows pending winnings as Incoming with an approximate release date. Incoming funds are not available to spend or withdraw until released.",
        "If a serious concern is raised and confirmed through review, payout release may pause until Anymarkt or the resolver completes review.",
        "After release — or if no valid challenge occurs — winnings move to your available live balance.",
        "Corrections and voids follow applicable payment, compliance, and provider rules. You are responsible for reviewing market terms and resolver duties before participating.",
      ],
    },
    {
      heading: "6. Disputes, reports, and support",
      bullets: [
        "Members may dispute a settled outcome through supported in-app flows.",
        "Members may report resolver misconduct — unfair settlement, harassment, coercion, fraud, or other concerns — through in-app forms.",
        "Email support is available for general questions and non-urgent issues.",
        "Urgent escalation is available for attested serious misconduct requiring prioritized review.",
        "Anymarkt reviews reports using automated signals and human investigators according to our policies and applicable law.",
      ],
    },
    {
      heading: "7. Platform override",
      paragraphs: [
        "Anymarkt may freeze, void, or correct any settlement for legal, compliance, fraud-prevention, or safety reasons, regardless of group administrator actions or member feedback. Platform decisions are final where permitted by applicable law.",
      ],
    },
    {
      heading: "8. Records",
      paragraphs: [
        "Settlement evidence, feedback, review actions, fraud signals, and related communications may be retained for disputes, audits, regulatory obligations, and fraud prevention as described in our Privacy Policy and Market Rules.",
      ],
    },
  ];
}

export function getGroupSettlementDisclosureDocument(
  jurisdiction: ComplianceJurisdiction = "US",
): PolicyDocument {
  return {
    kind: "market_rules",
    jurisdiction,
    version: VERSION,
    title: "Private Group Settlement & Review",
    route: "/group-settlements",
    lastUpdated: LAST_UPDATED,
    seoDescription:
      "How private group prediction settlements, optional member feedback, algorithmic review, fraud controls, and platform oversight work on Anymarkt.",
    sections: buildSections(),
  };
}

/** Short copy for in-app notices (no technical jargon). */
export const GROUP_SETTLEMENT_NOTICE = {
  ratingPrompt:
    "Optional feedback helps protect group integrity. Only bettors may respond. Negative feedback requires a brief explanation. This is not an automatic vote to reverse results.",
  ratingLink: "How settlement feedback works",
  integrityLink: "Platform integrity & fraud prevention",
  challengedTitle: "Settlement under review",
  challengedBody:
    "Enough members flagged concerns about this outcome. The resolver may respond with evidence during the waiting period. Anymarkt's fraud detection and compliance systems may also review or override.",
  adminDisclaimerSummary:
    "As a group administrator you settle predictions, may receive member feedback, and are subject to automated review, fraud detection, and platform override.",
} as const;
