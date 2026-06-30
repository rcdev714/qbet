import type { ComplianceJurisdiction } from "../compliance/jurisdiction";
import { DEFAULT_JURISDICTION } from "../compliance/jurisdiction";
import type { PolicyKind } from "../compliance/policy";
import { REQUIRED_POLICY_KINDS } from "../compliance/policy";
import type { UiLocale } from "../i18n/locale";
import { resolvePolicyLocale } from "../i18n/locale";
import { EC_SPANISH_POLICY_DOCUMENTS } from "./policy-content-es-ec";
import { US_SPANISH_POLICY_DOCUMENTS } from "./policy-content-es-us";
import {
    emailLink,
    externalLink,
    frameworkBullets,
    joinNodes,
    OFFICIAL_URLS,
    policyLink,
    txt,
    type PolicyRichText,
} from "./policy-links";

export type PolicySection = {
  heading: string;
  paragraphs?: PolicyRichText[];
  bullets?: PolicyRichText[];
  clauses?: {
    label?: string;
    text: PolicyRichText;
    bullets?: PolicyRichText[];
  }[];
};

export type PolicyDocument = {
  kind: PolicyKind;
  jurisdiction: ComplianceJurisdiction;
  version: string;
  title: string;
  route: string;
  lastUpdated: string;
  seoDescription: string;
  sections: PolicySection[];
};

export const POLICY_VERSION = "2026-06-22-legal-references";

const LAST_UPDATED = "June 22, 2026";
const SUPPORT_EMAIL = "support@anymarkt.com";

export const POLICY_KIND_LABELS: Record<PolicyKind, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
  risk_disclosure: "Real-Money Market Risk Disclosure",
  market_rules: "Market Creation and Resolution Rules",
  aml_kyc: "AML and KYC Policy",
  prohibited_markets: "Prohibited Markets Policy",
};

type JurisdictionCopy = {
  jurisdiction: ComplianceJurisdiction;
  frameworkName: string;
  regulatoryPosition: string;
  sportsPosition: string;
  privacyRights: string;
  amlPosture: string;
  disputeForum: string;
};

const US_COPY: JurisdictionCopy = {
  jurisdiction: "US",
  frameworkName: "United States compliance framework",
  regulatoryPosition:
    "Anymarkt operates as a social future-event prediction market platform under a United States launch posture. Availability of Live wallet features may vary by state, user status, market type, payment rail, and provider approval.",
  sportsPosition:
    "Sports markets may be subject to additional review, state restrictions, public-feed limitations, or removal where the Company determines that availability would create legal, integrity, or consumer-risk concerns.",
  privacyRights:
    "Depending on where you live, you may have rights to access, correct, delete, port, or opt out of certain processing of personal information. We honor legally required requests and may retain records needed for fraud prevention, security, payments, tax, disputes, and compliance.",
  amlPosture:
    "For United States users, Anymarkt maintains a risk-based AML, sanctions, fraud, and payments compliance program using identity verification, transaction monitoring, restricted activity reviews, provider controls, and record retention.",
  disputeForum:
    "For United States users, disputes are subject to individual binding arbitration, jury-trial waiver, and class-action waiver to the maximum extent permitted by applicable law.",
};

const EC_COPY: JurisdictionCopy = {
  jurisdiction: "EC",
  frameworkName: "Ecuador compliance framework",
  regulatoryPosition:
    "Anymarkt operates in Ecuador under a cautious non-sports future-event framework. The product is designed as a user-generated prediction market platform and not as a public sports betting operator during the Ecuador launch posture.",
  sportsPosition:
    "Sports markets are excluded from public discovery and may be blocked, frozen, voided, or held for legal review in Ecuador. Sensitive categories also require manual review before any public availability.",
  privacyRights:
    "For Ecuador users, Anymarkt applies principles aligned with Ecuador's Organic Law on Personal Data Protection, including transparency, purpose limitation, data minimization, security, retention discipline, and the exercise of legally available access, correction, deletion, opposition, suspension, and portability rights.",
  amlPosture:
    "For Ecuador users, Anymarkt maintains a UAFE-ready operating posture, including identity verification, sanctions screening, transaction monitoring, ledger exports, enhanced review triggers, and evidence preservation for counsel, payment partners, and competent authorities where required.",
  disputeForum:
    "For Ecuador users, disputes will be handled through the procedures and forums available under applicable Ecuador law, unless another lawful dispute process is presented and accepted by the user.",
};

function createPolicyDocument(
  document: Omit<PolicyDocument, "lastUpdated" | "version">,
): PolicyDocument {
  return {
    version: POLICY_VERSION,
    lastUpdated: LAST_UPDATED,
    ...document,
  };
}

function relatedPoliciesSection(
  currentKind: PolicyKind,
  jurisdiction: ComplianceJurisdiction,
): PolicySection {
  return {
    heading: "Related Anymarkt Policies",
    paragraphs: [
      "The following required policies form part of the same compliance framework and should be read together:",
    ],
    bullets: REQUIRED_POLICY_KINDS.filter((kind) => kind !== currentKind).map((kind) =>
      policyLink(kind, POLICY_KIND_LABELS[kind]),
    ),
  };
}

function frameworksSection(
  copy: JurisdictionCopy,
  focus: "privacy" | "aml" | "terms" | "general",
): PolicySection {
  return {
    heading: "Legal and Regulatory Frameworks",
    paragraphs: [
      joinNodes(
        txt(
          "Anymarkt is designed to align with applicable legal, regulatory, and provider frameworks under the ",
        ),
        txt(copy.frameworkName),
        txt(
          ". The following official and provider resources provide context for our compliance posture:",
        ),
      ),
    ],
    bullets: frameworkBullets(copy.jurisdiction, focus),
  };
}

function contactSection(): PolicySection {
  return {
    heading: "Contact",
    paragraphs: [
      joinNodes(
        txt("Questions, legal notices, privacy requests, safety reports, and compliance inquiries may be sent to "),
        emailLink(SUPPORT_EMAIL, SUPPORT_EMAIL),
        txt("."),
      ),
      "If you are contacting us about fraud, account compromise, illegal content, self-harm, threats, or market manipulation, include the relevant username, market, transaction, message, or report details so we can investigate promptly.",
    ],
  };
}

function termsSections(copy: JurisdictionCopy): PolicySection[] {
  return [
    {
      heading: "Important Notice",
      paragraphs: [
        joinNodes(
          txt("These Terms of Service govern your use of Anymarkt under the "),
          txt(copy.frameworkName),
          txt(
            ". They form a legal agreement between you and Anymarkt, including the rules for Play Mode, Live wallet features, user-generated content, market creation, fraud prevention, identity verification, moderation, and account restrictions.",
          ),
        ),
        copy.disputeForum,
      ],
    },
    {
      heading: "1. Acceptance and Changes",
      clauses: [
        {
          label: "1.1 Agreement.",
          text: joinNodes(
            txt("By creating an account, accessing the app, viewing markets, posting content, placing a prediction, using a wallet feature, or otherwise using Anymarkt, you agree to these Terms and to the required legal policies linked in the app, including the "),
            policyLink("privacy", "Privacy Policy"),
            txt(", "),
            policyLink("risk_disclosure", "Risk Disclosure"),
            txt(", "),
            policyLink("market_rules", "Market Rules"),
            txt(", "),
            policyLink("aml_kyc", "AML and KYC Policy"),
            txt(", and "),
            policyLink("prohibited_markets", "Prohibited Markets Policy"),
            txt("."),
          ),
        },
        {
          label: "1.2 Policy set.",
          text: joinNodes(
            txt("The "),
            policyLink("terms", "Terms of Service"),
            txt(", "),
            policyLink("privacy", "Privacy Policy"),
            txt(", "),
            policyLink("risk_disclosure", "Risk Disclosure"),
            txt(", "),
            policyLink("market_rules", "Market Creation and Resolution Rules"),
            txt(", "),
            policyLink("aml_kyc", "AML and KYC Policy"),
            txt(", and "),
            policyLink("prohibited_markets", "Prohibited Markets Policy"),
            txt(" together create the transparent legal and compliance framework for the service."),
          ),
        },
        {
          label: "1.3 Updates.",
          text: "We may update the policy set to reflect product changes, legal requirements, safety controls, provider requirements, or operational improvements. If a policy version becomes required, you may need to review and accept it before continuing to use restricted features.",
        },
      ],
    },
    {
      heading: "2. Nature of the Service",
      paragraphs: [copy.regulatoryPosition],
      clauses: [
        {
          label: "2.1 Social prediction platform.",
          text: "Anymarkt lets users create, discuss, and participate in future-event markets with objective resolution criteria. Markets are intended to be social, informational, and entertainment-oriented tools, not personalized financial, legal, tax, or investment advice.",
        },
        {
          label: "2.2 Play Mode.",
          text: "Play Mode uses virtual credits only. Play credits have no cash value, cannot be redeemed for money, goods, services, or other consideration, and are not deposits or stored value.",
        },
        {
          label: "2.3 Live wallet.",
          text: joinNodes(
            txt("Live wallet features, where available, involve real funds and are subject to identity verification under our "),
            policyLink("aml_kyc", "AML and KYC Policy"),
            txt(", age attestation, sanctions screening, payment-provider rules, jurisdiction rules, risk limits, market approvals, and ongoing monitoring described in our "),
            policyLink("risk_disclosure", "Risk Disclosure"),
            txt("."),
          ),
        },
        {
          label: "2.4 No guaranteed availability.",
          text: "We may limit, suspend, or discontinue any market, wallet rail, payment method, jurisdiction, category, user feature, or provider integration where needed for safety, fraud prevention, legal compliance, platform integrity, or business operations.",
        },
      ],
    },
    {
      heading: "3. Eligibility and Account Duties",
      clauses: [
        {
          label: "3.1 Age.",
          text: "You must be at least 17 years old and old enough under the laws applicable to you to use the app and any Live wallet feature. We may require age attestation or identity verification before access to restricted features.",
        },
        {
          label: "3.2 Accurate information.",
          text: "You must provide accurate account, residence, payment, tax, and identity information and keep it current. You may not misrepresent your location, identity, age, source of funds, or eligibility.",
        },
        {
          label: "3.3 Account security.",
          text: "You are responsible for maintaining control of your account credentials and devices. Notify us immediately if you suspect account compromise, unauthorized activity, fraud, or misuse.",
        },
        {
          label: "3.4 One account.",
          text: "Unless we approve otherwise, you may not create or control multiple accounts, share accounts, sell accounts, use another person's account, or use the app for another person's benefit to evade limits or controls.",
        },
      ],
    },
    {
      heading: "4. Fraud, Harm, and Illegal Behavior Prevention",
      paragraphs: [
        "Anymarkt operates a layered trust and safety program designed to detect, prevent, investigate, and respond to fraud, platform manipulation, illegal activity, abusive content, and user harm.",
      ],
      bullets: [
        "Identity verification, age attestation, sanctions and restricted-person screening, payment-provider checks, and residence-based compliance gates.",
        "Risk scoring using account, device, network, market, transaction, wallet, and behavioral signals where lawful and appropriate.",
        "Monitoring for collusion, wash activity, multi-accounting, chargeback abuse, stolen payment methods, synthetic identity indicators, suspicious velocity, market manipulation, and abuse of referral or promotional systems.",
        "Manual review workflows, account freezes, market freezes, content reports, user blocks, administrator review, and escalation to payment partners or authorities where legally required.",
      ],
    },
    {
      heading: "5. User Content and Community Safety",
      clauses: [
        {
          label: "5.1 User-generated content.",
          text: "Markets, comments, chat messages, profile information, media, reports, usernames, and resolution proposals may be user-generated content. You are responsible for content you submit and must have all rights needed to submit it.",
        },
        {
          label: "5.2 Zero tolerance.",
          text: joinNodes(
            txt("We have zero tolerance for content that is illegal, exploitative, threatening, hateful, harassing, sexually explicit, defamatory, deceptive, promotes self-harm, encourages violence, targets private individuals for harm, or otherwise creates an unsafe environment, consistent with "),
            externalLink("Apple App Store Review Guidelines", OFFICIAL_URLS.appleAppStoreGuidelines),
            txt(" for user-generated content apps."),
          ),
        },
        {
          label: "5.3 Reporting and blocking.",
          text: "You may report content or users from supported chat, market, and profile surfaces. You may also block users where the feature is available. We may remove content, restrict users, freeze accounts, or escalate urgent safety reports.",
        },
        {
          label: "5.4 Moderation discretion.",
          text: "We may review, preserve, remove, hide, limit distribution of, or report content where we believe it violates the policy set, threatens user safety, creates legal risk, undermines market integrity, or is required by law or provider rules.",
        },
      ],
    },
    {
      heading: "6. Markets, Resolution, and Wallet Activity",
      clauses: [
        {
          label: "6.1 Market standards.",
          text: joinNodes(
            txt("Each market must identify a good-faith future event, objective outcomes, a close time, a resolution source, and any special settlement rules, as described in our "),
            policyLink("market_rules", "Market Creation and Resolution Rules"),
            txt(" and "),
            policyLink("prohibited_markets", "Prohibited Markets Policy"),
            txt(". Ambiguous, misleading, unverifiable, manipulated, or prohibited markets may be rejected, frozen, voided, or corrected."),
          ),
        },
        {
          label: "6.2 User responsibility.",
          text: "You are responsible for reviewing market terms, resolution sources, odds, liquidity, fees, restrictions, and risks before participating. Outcomes may be uncertain and you may lose funds used in Live wallet markets.",
        },
        {
          label: "6.3 Provider rules.",
          text: joinNodes(
            txt("Deposits, withdrawals, identity checks, payment processing, and custody-related services may be provided by third parties such as Stripe under the "),
            externalLink("Stripe Consumer Terms of Service", OFFICIAL_URLS.stripeConsumerTerms),
            txt(". Their terms, rules, screening decisions, outages, holds, or rejections may affect your access."),
          ),
        },
        {
          label: "6.4 Corrections.",
          text: "We may correct obvious errors, technical failures, duplicate settlements, fraudulent activity, or manipulative outcomes. We may void or reverse affected activity where permitted and appropriate.",
        },
      ],
    },
    {
      heading: "7. Prohibited Conduct",
      bullets: [
        "Using the app for illegal activity, fraud, sanctions evasion, money laundering, terrorist financing, bribery, corruption, trafficking, exploitation, harassment, threats, or harm.",
        "Creating prohibited markets, manipulating markets, coordinating abusive trading, using bots or automation without approval, scraping, attacking, reverse engineering, or bypassing security controls.",
        "Submitting false KYC information, using stolen payment methods, disguising location, laundering funds, structuring activity to avoid review, or helping others evade compliance controls.",
        "Interfering with reports, investigations, audits, account restrictions, moderation decisions, payment reviews, or regulatory obligations.",
      ],
    },
    {
      heading: "8. Suspension, Termination, and Enforcement",
      paragraphs: [
        "We may warn, limit, suspend, freeze, terminate, restrict wallet features, remove content, void markets, hold withdrawals, preserve evidence, or block access if we believe your activity violates the policy set, creates risk, or requires review.",
      ],
      clauses: [
        {
          label: "8.1 Review.",
          text: "Some restrictions may be temporary while we review identity, payment, market, fraud, safety, legal, or provider signals. We are not required to disclose risk models, confidential investigation details, or security-sensitive information.",
        },
        {
          label: "8.2 Funds.",
          text: joinNodes(
            txt("Where Live wallet funds are involved, release, return, settlement, or withholding of funds may depend on applicable law, payment-provider rules, chargeback risk, sanctions review, tax or AML obligations under our "),
            policyLink("aml_kyc", "AML and KYC Policy"),
            txt(", and dispute outcomes."),
          ),
        },
      ],
    },
    {
      heading: "9. Disclaimers and Limits",
      paragraphs: [
        'The app is provided "as is" and "as available" to the maximum extent permitted by law. We do not guarantee uninterrupted service, market availability, particular outcomes, profits, liquidity, data accuracy from third-party sources, or that all abuse can be prevented.',
        "To the maximum extent permitted by law, Anymarkt is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost data, market losses, provider failures, or unauthorized activity that could not reasonably be prevented.",
      ],
    },
    relatedPoliciesSection("terms", copy.jurisdiction),
    frameworksSection(copy, "terms"),
    contactSection(),
  ];
}

function privacySections(copy: JurisdictionCopy): PolicySection[] {
  const privacyFrameworkParagraph: PolicyRichText =
    copy.jurisdiction === "EC"
      ? joinNodes(
          txt("For Ecuador users, Anymarkt applies principles aligned with the "),
          externalLink(
            "Superintendencia de Protección de Datos Personales (LOPDP)",
            OFFICIAL_URLS.ecuadorLopdp,
          ),
          txt(
            ", including transparency, purpose limitation, data minimization, security, retention discipline, and the exercise of legally available access, correction, deletion, opposition, suspension, and portability rights.",
          ),
        )
      : joinNodes(
          txt("Depending on where you live, you may have rights under applicable US privacy frameworks, including state laws such as the "),
          externalLink("California Consumer Privacy Act (CCPA)", OFFICIAL_URLS.ccpaOverview),
          txt(
            ", to access, correct, delete, port, or opt out of certain processing of personal information. We honor legally required requests and may retain records needed for fraud prevention, security, payments, tax, disputes, and compliance.",
          ),
        );

  return [
    {
      heading: "1. Overview",
      paragraphs: [
        joinNodes(
          txt("This Privacy Policy explains how Anymarkt collects, uses, discloses, retains, and protects information under the "),
          txt(copy.frameworkName),
          txt(". It should be read together with our "),
          policyLink("terms", "Terms of Service"),
          txt(" and "),
          policyLink("aml_kyc", "AML and KYC Policy"),
          txt(". We use information to operate a transparent prediction market platform and to maintain extensive systems for fraud, harm, illegal behavior, and market-manipulation prevention."),
        ),
      ],
    },
    {
      heading: "2. Information We Collect",
      bullets: [
        "Account data such as email, username, profile details, authentication identifiers, residence country, phone number if provided, age attestation, preferences, and support messages.",
        "Market and social activity such as markets created, predictions, orders, settlements, chats, reports, blocks, profile interactions, public feed activity, and moderation history.",
        "Device, network, and usage data such as IP address, device identifiers, operating system, browser, app version, session events, approximate location derived from network signals, crash logs, and security telemetry.",
        "Payment, wallet, KYC, and compliance data such as verification status, provider references, transaction history, ledger entries, sanctions or risk review results, chargeback signals, tax or regulatory export fields, and identity-session metadata.",
        joinNodes(
          txt("Identity verification data processed by providers such as "),
          externalLink("Stripe Identity", OFFICIAL_URLS.stripeIdentity),
          txt(" or Stripe Connect. Depending on the provider flow, this may include document images, biometric-derived checks, liveness signals, and verification results. We do not store full payment card numbers on our servers."),
        ),
      ],
    },
    {
      heading: "3. How We Use Information",
      bullets: [
        "Create, authenticate, secure, and administer accounts.",
        "Operate Play Mode, Live wallet features, markets, feeds, chat, reports, moderation, settlement, and support.",
        "Verify eligibility, residence, age, identity, payment status, sanctions status, and provider approval.",
        "Detect, prevent, investigate, and respond to fraud, illegal activity, market manipulation, abuse, self-harm risks, harassment, account compromise, and payment disputes.",
        "Maintain audit logs, ledger records, compliance reports, tax or accounting records, regulatory exports, and evidence needed for legal, safety, or provider obligations.",
        "Improve app reliability, security, performance, product design, and customer support.",
      ],
    },
    {
      heading: "4. Fraud, Safety, and Compliance Processing",
      paragraphs: [
        "We may process information using automated tools, rules, risk scoring, alerts, and manual review to protect users and the platform. These systems may combine account, transaction, content, device, network, behavioral, market, and provider signals.",
        "If activity appears risky, illegal, abusive, or inconsistent with our policies, we may limit features, request more information, freeze activity, preserve records, report content, reject transactions, or escalate the matter to providers, counsel, regulators, law enforcement, or safety teams where appropriate.",
      ],
    },
    {
      heading: "5. Sharing and Processors",
      paragraphs: [
        "We do not sell personal information. We share information only as needed to operate the app, protect users, process payments, verify identity, comply with law, enforce policies, or complete corporate transactions.",
      ],
      bullets: [
        joinNodes(
          txt("Infrastructure, database, hosting, analytics, logging, and security providers, including "),
          externalLink("Supabase", OFFICIAL_URLS.supabasePrivacy),
          txt(" under its "),
          externalLink("Data Processing Addendum", OFFICIAL_URLS.supabaseDpa),
          txt("."),
        ),
        joinNodes(
          txt("Identity, payment, wallet, banking, card, fraud, chargeback, sanctions, and compliance providers, including "),
          externalLink("Stripe", OFFICIAL_URLS.stripePrivacy),
          txt(" where used."),
        ),
        "Professional advisers, auditors, counsel, insurers, tax providers, and accounting providers.",
        "Regulators, courts, law enforcement, safety organizations, payment networks, or other parties when required or reasonably necessary to protect rights, safety, compliance, or platform integrity.",
      ],
    },
    {
      heading: "6. Retention",
      paragraphs: [
        "We retain information for as long as needed for the purposes described in this policy, including account operation, security, fraud prevention, legal claims, tax, accounting, AML/KYC, payment disputes, regulatory reporting, and audit obligations.",
        "Some records may be retained after account deletion where required or appropriate for compliance, safety, fraud prevention, chargebacks, investigations, or legal defense. We may anonymize or aggregate data where practical.",
      ],
    },
    {
      heading: "7. Your Rights and Choices",
      paragraphs: [privacyFrameworkParagraph],
      bullets: [
        "You may update certain account information in the app.",
        "You may request deletion through the Settings delete-account flow or by contacting support.",
        "You may contact us to request access, correction, deletion, portability, objection, restriction, or other legally available rights.",
        "We may need to verify your identity before fulfilling a request and may deny or limit requests where retention is legally required or needed for fraud, safety, payment, or compliance purposes.",
      ],
    },
    {
      heading: "8. Security",
      paragraphs: [
        "We use administrative, technical, and organizational safeguards intended to protect information, including access controls, role-based permissions, provider security controls, monitoring, audit logs, and review workflows.",
        "No system is perfectly secure. You should use strong account credentials, protect your devices, and notify us promptly about suspected unauthorized activity.",
      ],
    },
    {
      heading: "9. Children and Age Restrictions",
      paragraphs: [
        "Anymarkt is not intended for children under 17. We do not knowingly solicit personal information from children under 13. If you believe a child has provided information to us, contact support so we can review and respond.",
      ],
    },
    relatedPoliciesSection("privacy", copy.jurisdiction),
    frameworksSection(copy, "privacy"),
    contactSection(),
  ];
}

function riskSections(copy: JurisdictionCopy): PolicySection[] {
  return [
    {
      heading: "1. Read Before Using Live Wallet Features",
      paragraphs: [
        joinNodes(
          txt("Live wallet participation involves real funds. You can lose the funds you use in markets. Do not participate with funds you cannot afford to lose, and do not treat Anymarkt as a savings, investment, lending, insurance, gambling, sportsbook, or financial-advice product. Read this disclosure together with our "),
          policyLink("terms", "Terms of Service"),
          txt(" and "),
          policyLink("market_rules", "Market Creation and Resolution Rules"),
          txt(" before participating."),
        ),
        copy.regulatoryPosition,
      ],
    },
    {
      heading: "2. Market and Resolution Risk",
      bullets: [
        "Outcomes may be uncertain, delayed, disputed, ambiguous, or affected by incomplete public information.",
        "Resolution sources may change, become unavailable, publish errors, or require interpretation.",
        joinNodes(
          txt("Markets may be frozen, voided, corrected, hidden, or manually reviewed if they are ambiguous, manipulated, prohibited under our "),
          policyLink("prohibited_markets", "Prohibited Markets Policy"),
          txt(", illegal, harmful, or technically affected."),
        ),
        "User-created markets may contain mistakes. You are responsible for reviewing the market description, outcomes, close time, resolver, source, category, and restrictions before participating.",
      ],
    },
    {
      heading: "3. Liquidity, Pricing, and Loss Risk",
      paragraphs: [
        "Prices may move quickly, liquidity may be limited, and you may not be able to exit a position at the price or time you expect. Past outcomes, leaderboards, market prices, comments, or social signals do not guarantee future results.",
        "Fees, spreads, provider costs, reversals, chargebacks, corrections, and settlement rules may affect your balance.",
      ],
    },
    {
      heading: "4. No Advice",
      paragraphs: [
        "Anymarkt does not provide investment, legal, tax, accounting, gambling, financial, or other professional advice. Content on the app, including markets, odds, chats, rankings, comments, and resolution sources, is not a recommendation.",
        "You are responsible for your own decisions and for understanding laws, taxes, and restrictions that apply to you.",
      ],
    },
    {
      heading: "5. Fraud, Manipulation, and Integrity Risk",
      paragraphs: [
        joinNodes(
          txt("Anymarkt operates fraud, harm, and illegal behavior prevention systems described in our "),
          policyLink("terms", "Terms of Service"),
          txt(" and "),
          policyLink("aml_kyc", "AML and KYC Policy"),
          txt(", but no system can prevent every attempted abuse. Markets may be affected by bots, collusion, false information, coordinated behavior, payment fraud, account compromise, or other misconduct."),
        ),
        "We may use risk controls, limits, manual review, freezes, voids, corrections, settlement delays, or account restrictions to reduce harm and protect market integrity.",
      ],
    },
    {
      heading: "6. Payment, Provider, and Operational Risk",
      bullets: [
        "Deposits, withdrawals, KYC, and payment methods may fail, be delayed, be rejected, or be reversed by providers.",
        "Provider outages, bank delays, card-network rules, chargebacks, sanctions screening, identity verification decisions, and compliance holds may affect your balance or access.",
        "App outages, data delays, software bugs, network issues, device issues, or third-party failures may affect market access or settlement timing.",
      ],
    },
    {
      heading: "7. Jurisdiction-Specific Notice",
      paragraphs: [copy.sportsPosition],
    },
    {
      heading: "8. Responsible Participation",
      bullets: [
        "Set personal limits and do not chase losses.",
        "Do not borrow funds to participate.",
        "Do not participate while impaired, under duress, or unable to understand the risks.",
        "Contact support if you need account restrictions, safety assistance, or help with suspicious activity.",
      ],
    },
    relatedPoliciesSection("risk_disclosure", copy.jurisdiction),
    frameworksSection(copy, "general"),
    contactSection(),
  ];
}

function marketRuleSections(copy: JurisdictionCopy): PolicySection[] {
  return [
    {
      heading: "1. Purpose",
      paragraphs: [
        joinNodes(
          txt("These rules govern market creation, public availability, participation, resolution, disputes, corrections, and enforcement. They should be read with our "),
          policyLink("prohibited_markets", "Prohibited Markets Policy"),
          txt(", "),
          policyLink("risk_disclosure", "Risk Disclosure"),
          txt(", and "),
          policyLink("terms", "Terms of Service"),
          txt(". They are designed to make markets transparent, objective, safe, and resistant to fraud, manipulation, harm, and illegal activity."),
        ),
      ],
    },
    {
      heading: "2. Market Requirements",
      bullets: [
        "A clear future event that can resolve to defined outcomes.",
        "Objective resolution criteria and a credible resolution source.",
        "A close time and settlement process that do not invite manipulation.",
        joinNodes(
          txt("A lawful and permitted category under the user's jurisdiction and the "),
          policyLink("prohibited_markets", "Prohibited Markets Policy"),
          txt("."),
        ),
        "No misleading title, hidden condition, unverifiable premise, private-person harm, or incentive to cause an outcome.",
      ],
    },
    {
      heading: "3. Creator Duties",
      clauses: [
        {
          label: "3.1 Good faith.",
          text: "Creators must submit markets in good faith and may not create markets to mislead users, exploit private information, manipulate settlement, harass individuals, promote illegal activity, or evade review.",
        },
        {
          label: "3.2 Resolution source.",
          text: "Creators should choose sources that are public, stable, independent, and specific. Where a source is ambiguous or unavailable, Anymarkt may use a reasonable substitute, manual review, or voiding process.",
        },
        {
          label: "3.3 Category accuracy.",
          text: "Creators must select accurate categories. Misclassification may lead to removal, public-feed exclusion, manual review, voiding, or account restriction.",
        },
      ],
    },
    {
      heading: "4. Public Feed and Manual Review",
      paragraphs: [copy.sportsPosition],
      bullets: [
        "Standard categories may be publicly visible if they meet objective-resolution and safety standards.",
        "Restricted categories such as finance-adjacent, politics, sports, or sensitive public events may require manual review.",
        "Prohibited categories must not be created or promoted and may be removed or voided without prior notice.",
      ],
    },
    {
      heading: "5. Resolution",
      clauses: [
        {
          label: "5.1 Normal settlement.",
          text: "Markets resolve according to their published criteria, outcomes, sources, and close time. Settlement may be automated, creator-assisted, admin-reviewed, or provider-supported depending on the market type.",
        },
        {
          label: "5.2 Disputes.",
          text: "Users may raise disputes where supported. Anymarkt may review evidence, source materials, market language, trading patterns, and policy requirements before confirming, correcting, delaying, or voiding settlement.",
        },
        {
          label: "5.3 Corrections.",
          text: "Anymarkt may correct obvious mistakes, technical errors, duplicate settlements, manipulated outcomes, source errors, or settlements inconsistent with the policy set.",
        },
      ],
    },
    {
      heading: "6. Manipulation and Integrity Controls",
      bullets: [
        "No collusion, wash activity, coordinated manipulation, false rumors, spoofing, bot abuse, multi-accounting, self-dealing, insider misuse, or artificial activity.",
        "No threatening, bribing, harassing, doxxing, coercing, or encouraging anyone to affect a real-world outcome.",
        "No attempts to overload, scrape, reverse engineer, bypass, or interfere with market, wallet, or moderation systems.",
        "Anymarkt may use detection systems, risk limits, review queues, transaction holds, market freezes, settlement delays, and evidence preservation to protect integrity.",
      ],
    },
    {
      heading: "7. Fees, Voids, and Reversals",
      paragraphs: [
        "Fees, voids, reversals, and corrections may apply as disclosed in the app or required by payment-provider rules, market rules, fraud controls, chargebacks, or legal obligations. If a market is voided, settlement treatment may depend on the state of the market, available balances, provider constraints, and applicable law.",
      ],
    },
    {
      heading: "8. Enforcement",
      paragraphs: [
        "Violations may result in warning, market removal, public-feed exclusion, settlement delay, market voiding, loss of creator privileges, account restriction, Live wallet suspension, payment hold, or termination.",
      ],
    },
    relatedPoliciesSection("market_rules", copy.jurisdiction),
    frameworksSection(copy, "general"),
    contactSection(),
  ];
}

function amlSections(copy: JurisdictionCopy): PolicySection[] {
  const amlFrameworkParagraph: PolicyRichText =
    copy.jurisdiction === "EC"
      ? joinNodes(
          txt("For Ecuador users, Anymarkt maintains a "),
          externalLink("UAFE", OFFICIAL_URLS.ecuadorUafe),
          txt("-ready operating posture, including identity verification, sanctions screening, transaction monitoring, ledger exports, enhanced review triggers, and evidence preservation for counsel, payment partners, and competent authorities where required."),
        )
      : joinNodes(
          txt("For United States users, Anymarkt maintains a risk-based program aligned with the "),
          externalLink("FinCEN Bank Secrecy Act", OFFICIAL_URLS.fincenBsa),
          txt(" framework and "),
          externalLink("OFAC sanctions programs", OFFICIAL_URLS.ofacSanctions),
          txt(", using identity verification, transaction monitoring, restricted activity reviews, provider controls, and record retention."),
        );

  return [
    {
      heading: "1. Policy Purpose",
      paragraphs: [
        joinNodes(
          txt("This AML and KYC Policy describes Anymarkt's risk-based program for identity verification, sanctions screening, transaction monitoring, fraud prevention, recordkeeping, and escalation under the "),
          txt(copy.frameworkName),
          txt(". It should be read with our "),
          policyLink("privacy", "Privacy Policy"),
          txt(", "),
          policyLink("terms", "Terms of Service"),
          txt(", and "),
          policyLink("prohibited_markets", "Prohibited Markets Policy"),
          txt("."),
        ),
        amlFrameworkParagraph,
      ],
    },
    {
      heading: "2. Identity Verification",
      bullets: [
        joinNodes(
          txt("Live wallet features may require identity verification through approved providers such as "),
          externalLink("Stripe Identity", OFFICIAL_URLS.stripeIdentity),
          txt(" or Stripe Connect."),
        ),
        "We may collect or receive verification status, provider identifiers, document-review results, liveness or biometric-derived verification results, sanctions or watchlist signals, and related metadata.",
        "We may require reverification when documents expire, risk changes, residence changes, provider rules require it, or suspicious activity is detected.",
        "Users who fail, refuse, or cannot complete verification may be limited to Play Mode or blocked from restricted features.",
      ],
    },
    {
      heading: "3. Sanctions, Restricted Persons, and Eligibility",
      paragraphs: [
        "Anymarkt may screen users, counterparties, payment instruments, and activity against sanctions, restricted-person, fraud, chargeback, and provider-risk signals. We may block, freeze, reject, or report activity involving sanctioned, restricted, ineligible, or high-risk persons.",
      ],
    },
    {
      heading: "4. Transaction Monitoring",
      bullets: [
        "Unusual deposit, withdrawal, transfer, prediction, settlement, refund, reversal, or chargeback patterns.",
        "Rapid movement of funds, structuring, circular activity, multiple accounts, shared devices, shared payment instruments, or inconsistent residence and network signals.",
        "Use of stolen credentials, synthetic identities, mule accounts, unauthorized payment methods, or suspicious source-of-funds indicators.",
        "Activity connected to prohibited markets, illegal content, market manipulation, sanctions evasion, money laundering, terrorist financing, exploitation, or other harm.",
      ],
    },
    {
      heading: "5. Enhanced Review and Account Holds",
      paragraphs: [
        "We may request more information, delay transactions, freeze balances, restrict markets, suspend withdrawals, or limit access while reviewing activity. Enhanced review may occur at risk thresholds, unusual activity triggers, provider requests, legal requests, or transaction amounts that require additional scrutiny.",
        "We are not required to disclose confidential monitoring rules, risk scores, provider signals, or investigation details.",
      ],
    },
    {
      heading: "6. Reporting, Escalation, and Cooperation",
      paragraphs: [
        "Where required or appropriate, Anymarkt may preserve evidence, prepare internal reports, cooperate with payment providers, respond to lawful requests, and escalate suspicious activity to counsel, auditors, regulators, law enforcement, or competent authorities.",
      ],
    },
    {
      heading: "7. Records and Retention",
      paragraphs: [
        "We retain KYC, transaction, ledger, compliance-event, provider, investigation, and support records as needed for AML, fraud prevention, legal defense, accounting, tax, payment disputes, regulatory reporting, and audit purposes. Records may be retained after account closure where required or appropriate.",
      ],
    },
    {
      heading: "8. User Responsibilities",
      bullets: [
        "Provide accurate identity, residence, payment, tax, and source-of-funds information.",
        "Use only payment methods and accounts that you are authorized to use.",
        "Do not attempt to evade limits, reviews, sanctions controls, location controls, or provider requirements.",
        "Report suspected unauthorized activity, fraud, account compromise, or illegal behavior promptly.",
      ],
    },
    relatedPoliciesSection("aml_kyc", copy.jurisdiction),
    frameworksSection(copy, "aml"),
    contactSection(),
  ];
}

function prohibitedSections(copy: JurisdictionCopy): PolicySection[] {
  return [
    {
      heading: "1. Purpose",
      paragraphs: [
        joinNodes(
          txt("This policy identifies markets, content, conduct, and activity that are prohibited or restricted on Anymarkt. It should be read with our "),
          policyLink("market_rules", "Market Creation and Resolution Rules"),
          txt(", "),
          policyLink("terms", "Terms of Service"),
          txt(", and "),
          policyLink("aml_kyc", "AML and KYC Policy"),
          txt(". It is designed to reduce incentives for harm, illegal behavior, fraud, manipulation, exploitation, and unsafe user-generated content."),
        ),
      ],
    },
    {
      heading: "2. Always Prohibited",
      bullets: [
        "Markets or content involving murder, death, serious injury, suicide, self-harm, assault, kidnapping, stalking, doxxing, threats, or targeted harm to an identifiable person.",
        "Sexual exploitation, child safety issues, non-consensual intimate content, trafficking, abuse, or content involving minors in unsafe or sexual contexts.",
        "Illegal goods or services, drugs, weapons, malware, hacking, stolen credentials, fraud services, counterfeit goods, bribery, corruption, evasion, or organized crime.",
        "Money laundering, terrorist financing, sanctions evasion, illegal gambling, unauthorized financial services, stolen payment methods, chargeback abuse, or source-of-funds concealment.",
        "Hate, harassment, discriminatory abuse, violent extremism, incitement, threats, or glorification of real-world violence.",
        "Markets that create incentives to cause, worsen, conceal, or profit from harm, crime, disasters, public emergencies, medical outcomes, or private-person misfortune.",
      ],
    },
    {
      heading: "3. Prohibited Market Categories",
      bullets: [
        "Individual health, personal safety, death, violence, hospitalization, arrest, divorce, employment termination, immigration enforcement, or private legal outcomes involving identifiable people.",
        "Active crimes, active court cases, active investigations, national security events, war operations, terrorism, kidnappings, or public safety incidents without explicit legal and safety approval.",
        "Events where resolution would require private data, non-public information, surveillance, doxxing, harassment, or unlawful access.",
        "Markets designed to manipulate public opinion, elections, prices, payment systems, app rankings, promotions, or the Anymarkt platform.",
      ],
    },
    {
      heading: "4. Restricted Categories",
      paragraphs: [copy.sportsPosition],
      bullets: [
        "Finance-adjacent, securities-adjacent, crypto, commodities, interest-rate, credit, insolvency, or company-specific markets may require legal and risk review.",
        "Political, election, public-office, public-policy, or civil-unrest markets may require manual review and may be blocked where they create legal, manipulation, or public-order risk.",
        "Health, disaster, emergency, crime, conflict, or public-safety topics may be blocked even when framed as public events.",
      ],
    },
    {
      heading: "5. Prohibited User Conduct",
      bullets: [
        "Manipulating markets, coordinating abusive trades, using bots without approval, multi-accounting, wash activity, self-dealing, or creating false signals.",
        "Harassing, threatening, bribing, coercing, impersonating, or doxxing users, creators, resolvers, moderators, public figures, or third parties.",
        "Submitting false reports, abusing reporting tools, interfering with investigations, or retaliating against reporters.",
        "Using Anymarkt to solicit illegal acts, evade law enforcement, bypass provider rules, or test stolen payment methods or compromised accounts.",
      ],
    },
    {
      heading: "6. Detection and Enforcement",
      paragraphs: [
        "Anymarkt uses automated signals, manual moderation, user reports, administrator review, market category rules, payment and identity provider controls, and compliance events to detect and respond to prohibited activity.",
        "Enforcement may include market rejection, public-feed exclusion, content removal, report escalation, account warning, account freeze, Live wallet restriction, withdrawal hold, market voiding, settlement correction, termination, evidence preservation, and referral to providers or authorities where appropriate.",
      ],
    },
    {
      heading: "7. Reporting",
      paragraphs: [
        "If you see illegal, harmful, abusive, fraudulent, manipulative, or prohibited activity, use the in-app reporting tools where available or contact support. Urgent threats, immediate physical danger, or emergencies should be reported to local emergency services first.",
      ],
    },
    relatedPoliciesSection("prohibited_markets", copy.jurisdiction),
    frameworksSection(copy, "general"),
    contactSection(),
  ];
}

const US_TERMS = createPolicyDocument({
  kind: "terms",
  jurisdiction: "US",
  title: "Terms of Service",
  route: "/terms",
  seoDescription: "Anymarkt Terms of Service governing use of the app in the United States framework.",
  sections: termsSections(US_COPY),
});

const EC_TERMS = createPolicyDocument({
  kind: "terms",
  jurisdiction: "EC",
  title: "Terms of Service",
  route: "/terms",
  seoDescription: "Anymarkt Terms of Service governing use of the app under the Ecuador compliance framework.",
  sections: termsSections(EC_COPY),
});

const US_PRIVACY = createPolicyDocument({
  kind: "privacy",
  jurisdiction: "US",
  title: "Privacy Policy",
  route: "/privacy",
  seoDescription: "Anymarkt Privacy Policy for the United States framework.",
  sections: privacySections(US_COPY),
});

const EC_PRIVACY = createPolicyDocument({
  kind: "privacy",
  jurisdiction: "EC",
  title: "Privacy Policy",
  route: "/privacy",
  seoDescription: "Anymarkt Privacy Policy for users under the Ecuador compliance framework.",
  sections: privacySections(EC_COPY),
});

const US_RISK = createPolicyDocument({
  kind: "risk_disclosure",
  jurisdiction: "US",
  title: "Real-Money Market Risk Disclosure",
  route: "/risk",
  seoDescription: "US risk disclosure for real-money prediction market activity.",
  sections: riskSections(US_COPY),
});

const EC_RISK = createPolicyDocument({
  kind: "risk_disclosure",
  jurisdiction: "EC",
  title: "Real-Money Market Risk Disclosure",
  route: "/risk",
  seoDescription: "Ecuador risk disclosure for non-sports future-event prediction markets.",
  sections: riskSections(EC_COPY),
});

const US_MARKET_RULES = createPolicyDocument({
  kind: "market_rules",
  jurisdiction: "US",
  title: "Market Creation and Resolution Rules",
  route: "/market-rules",
  seoDescription: "Rules for creating and resolving markets under the US framework.",
  sections: marketRuleSections(US_COPY),
});

const EC_MARKET_RULES = createPolicyDocument({
  kind: "market_rules",
  jurisdiction: "EC",
  title: "Market Creation and Resolution Rules",
  route: "/market-rules",
  seoDescription: "Rules for creating and resolving markets under the Ecuador framework.",
  sections: marketRuleSections(EC_COPY),
});

const US_AML = createPolicyDocument({
  kind: "aml_kyc",
  jurisdiction: "US",
  title: "AML and KYC Policy",
  route: "/aml-kyc",
  seoDescription: "US AML and KYC policy for live wallet users.",
  sections: amlSections(US_COPY),
});

const EC_AML = createPolicyDocument({
  kind: "aml_kyc",
  jurisdiction: "EC",
  title: "AML and KYC Policy",
  route: "/aml-kyc",
  seoDescription: "Ecuador AML/KYC posture for live wallet and payment rails.",
  sections: amlSections(EC_COPY),
});

const US_PROHIBITED = createPolicyDocument({
  kind: "prohibited_markets",
  jurisdiction: "US",
  title: "Prohibited Markets Policy",
  route: "/prohibited-markets",
  seoDescription: "Prohibited market categories under the US framework.",
  sections: prohibitedSections(US_COPY),
});

const EC_PROHIBITED = createPolicyDocument({
  kind: "prohibited_markets",
  jurisdiction: "EC",
  title: "Prohibited Markets Policy",
  route: "/prohibited-markets",
  seoDescription: "Prohibited market categories under the Ecuador framework.",
  sections: prohibitedSections(EC_COPY),
});

export const POLICY_DOCUMENTS_BY_JURISDICTION: Record<
  ComplianceJurisdiction,
  Record<PolicyKind, PolicyDocument>
> = {
  US: {
    terms: US_TERMS,
    privacy: US_PRIVACY,
    risk_disclosure: US_RISK,
    market_rules: US_MARKET_RULES,
    aml_kyc: US_AML,
    prohibited_markets: US_PROHIBITED,
  },
  EC: {
    terms: EC_TERMS,
    privacy: EC_PRIVACY,
    risk_disclosure: EC_RISK,
    market_rules: EC_MARKET_RULES,
    aml_kyc: EC_AML,
    prohibited_markets: EC_PROHIBITED,
  },
};

export const POLICY_ROUTE_ORDER: PolicyKind[] = [
  "terms",
  "privacy",
  "risk_disclosure",
  "market_rules",
  "aml_kyc",
  "prohibited_markets",
];

function resolveLocalizedPolicyPack(
  jurisdiction: ComplianceJurisdiction,
  countryCode?: string | null,
  policyLocale?: UiLocale,
) {
  const locale = policyLocale ?? resolvePolicyLocale(countryCode);
  if (locale === "es") {
    return jurisdiction === "EC" ? EC_SPANISH_POLICY_DOCUMENTS : US_SPANISH_POLICY_DOCUMENTS;
  }
  return POLICY_DOCUMENTS_BY_JURISDICTION[jurisdiction];
}

export function getPolicyDocuments(
  jurisdiction: ComplianceJurisdiction = DEFAULT_JURISDICTION,
  countryCode?: string | null,
  policyLocale?: UiLocale,
) {
  return resolveLocalizedPolicyPack(jurisdiction, countryCode, policyLocale);
}

export function getPolicyDocument(
  kind: PolicyKind,
  jurisdiction: ComplianceJurisdiction = DEFAULT_JURISDICTION,
  countryCode?: string | null,
  policyLocale?: UiLocale,
): PolicyDocument {
  return resolveLocalizedPolicyPack(jurisdiction, countryCode, policyLocale)[kind];
}

export function getPolicyByRoute(
  route: string,
  jurisdiction: ComplianceJurisdiction = DEFAULT_JURISDICTION,
  countryCode?: string | null,
  policyLocale?: UiLocale,
): PolicyDocument | undefined {
  return Object.values(getPolicyDocuments(jurisdiction, countryCode, policyLocale)).find(
    (doc) => doc.route === route,
  );
}

/** @deprecated Use getPolicyDocuments(jurisdiction) */
export const POLICY_DOCUMENTS = POLICY_DOCUMENTS_BY_JURISDICTION.US;

export function policyRouteWithJurisdiction(
  route: string,
  jurisdiction: ComplianceJurisdiction,
): string {
  return `${route}?jurisdiction=${jurisdiction}`;
}
