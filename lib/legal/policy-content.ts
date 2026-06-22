import type { ComplianceJurisdiction } from "../compliance/jurisdiction";
import { DEFAULT_JURISDICTION } from "../compliance/jurisdiction";
import type { PolicyKind } from "../compliance/policy";

export type PolicySection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type PolicyDocument = {
  kind: PolicyKind;
  jurisdiction: ComplianceJurisdiction;
  title: string;
  route: string;
  lastUpdated: string;
  seoDescription: string;
  sections: PolicySection[];
};

const US_TERMS: PolicyDocument = {
  kind: "terms",
  jurisdiction: "US",
  title: "Terms of Service",
  route: "/terms",
  lastUpdated: "June 22, 2026",
  seoDescription: "AnyMarket Terms of Service governing use of the app in the United States framework.",
  sections: [
    { heading: "Important Notice", paragraphs: ["These Terms contain a binding arbitration provision and waiver of jury trials and class actions. They include clauses required by Apple for user-generated content apps."] },
    { heading: "1. Acceptance of Terms", paragraphs: ['This Agreement governs your use of AnyMarket ("we", "us"). By accessing the App, you agree to these terms.'] },
    { heading: "2. Nature of the Service", paragraphs: ["AnyMarket is a social prediction platform. Play Mode uses virtual credits with no cash value. Live wallet features involve real funds and additional disclosures apply."] },
    { heading: "3. User Generated Content", paragraphs: ["Zero tolerance for objectionable content including harassment, violence, sexual content, and self-harm encouragement."], bullets: ["Reporting and blocking tools are available.", "Violations may result in account termination."] },
    { heading: "4. Eligibility", paragraphs: ["You must be at least 17 years of age."] },
    { heading: "5. Disclaimer and Liability", paragraphs: ['The App is provided "as is" to the maximum extent permitted by applicable US law.'] },
    { heading: "6. Dispute Resolution", paragraphs: ["Disputes are resolved by binding AAA arbitration on an individual basis."] },
    { heading: "7. Contact", paragraphs: ["Support: support@anymarket.app"] },
  ],
};

const EC_TERMS: PolicyDocument = {
  ...US_TERMS,
  jurisdiction: "EC",
  lastUpdated: "June 22, 2026",
  seoDescription: "AnyMarket Terms of Service governing use of the app under the Ecuador compliance framework.",
  sections: [
    ...US_TERMS.sections.slice(0, 2),
    { heading: "2. Nature of the Service", paragraphs: ["AnyMarket provides future-event prediction markets chosen by users. We are not a licensed sportsbook (operador de pronósticos deportivos). Play Mode uses virtual credits with no cash value."] },
    ...US_TERMS.sections.slice(3),
  ],
};

const US_PRIVACY: PolicyDocument = {
  kind: "privacy",
  jurisdiction: "US",
  title: "Privacy Policy",
  route: "/privacy",
  lastUpdated: "June 22, 2026",
  seoDescription: "AnyMarket Privacy Policy for the United States framework.",
  sections: [
    { heading: "1. Introduction", paragraphs: ["AnyMarket explains how we collect, use, and safeguard your information when you use the App."] },
    { heading: "2. Information We Collect", paragraphs: ["We collect account, device, and payment-related data as needed to operate the service."], bullets: ["Email, username, profile image", "Device and usage data", "Payment data processed by Stripe (not full card numbers on our servers)"] },
    { heading: "3. How We Use Information", paragraphs: ["To operate your account, prevent fraud, improve the App, and send administrative notices."] },
    { heading: "4. Sharing", paragraphs: ["We do not sell personal data. We share with processors such as Stripe and Supabase when necessary."] },
    { heading: "5. Your Rights", paragraphs: ["You may update profile data in Settings or delete your account using the Delete Account control."] },
    { heading: "6. Contact", paragraphs: ["support@anymarket.app"] },
  ],
};

const EC_PRIVACY: PolicyDocument = {
  ...US_PRIVACY,
  jurisdiction: "EC",
  seoDescription: "AnyMarket Privacy Policy for users under the Ecuador compliance framework (LOPDP-oriented).",
  sections: [
    ...US_PRIVACY.sections.slice(0, 4),
    { heading: "5. Ecuador Data Protection", paragraphs: ["Where applicable, we process personal and KYC data in line with Ecuador data protection principles. Identity verification may involve biometric data processed by Stripe."] },
    { heading: "6. Your Rights", paragraphs: ["You may update profile data in Settings or delete your account. Some records may be retained in anonymized form for AML and legal compliance."] },
    { heading: "7. Contact", paragraphs: ["support@anymarket.app"] },
  ],
};

const US_RISK: PolicyDocument = {
  kind: "risk_disclosure",
  jurisdiction: "US",
  title: "Real-Money Market Risk Disclosure",
  route: "/risk",
  lastUpdated: "June 22, 2026",
  seoDescription: "US risk disclosure for real-money prediction market activity.",
  sections: [
    { heading: "1. Real-Money Risk", paragraphs: ["Live wallet activity involves real funds. You may lose money. Past performance does not guarantee future results."] },
    { heading: "2. Not Investment Advice", paragraphs: ["AnyMarket does not provide investment, legal, or tax advice. Markets are not securities."] },
    { heading: "3. State and Local Laws", paragraphs: ["US users are responsible for laws applicable in their state or locality."] },
    { heading: "4. Your Responsibility", paragraphs: ["Only risk funds you can afford to lose. Verify resolution sources before participating."] },
  ],
};

const EC_RISK: PolicyDocument = {
  kind: "risk_disclosure",
  jurisdiction: "EC",
  title: "Real-Money Market Risk Disclosure",
  route: "/risk",
  lastUpdated: "June 22, 2026",
  seoDescription: "Ecuador risk disclosure for non-sports future-event prediction markets.",
  sections: [
    { heading: "1. Regulatory Position", paragraphs: ["AnyMarket offers non-sports future-event prediction markets. We are not a LOPD-licensed sportsbook operator. Product classification may evolve; counsel review is ongoing."] },
    { heading: "2. Real-Money Risk", paragraphs: ["Live wallet activity involves real funds. You may lose money placed on markets."] },
    { heading: "3. Not Investment Advice", paragraphs: ["Markets are social prediction tools, not regulated investment products."] },
    { heading: "4. Your Responsibility", paragraphs: ["You are responsible for understanding Ecuador laws applicable to you and only risking funds you can afford to lose."] },
  ],
};

const US_MARKET_RULES: PolicyDocument = {
  kind: "market_rules",
  jurisdiction: "US",
  title: "Market Creation and Resolution Rules",
  route: "/market-rules",
  lastUpdated: "June 22, 2026",
  seoDescription: "Rules for creating and resolving markets under the US framework.",
  sections: [
    { heading: "1. Market Structure", paragraphs: ["Each market declares outcomes, close time, resolution source, and resolver model."] },
    { heading: "2. Creator Duties", paragraphs: ["Creators attest to good-faith future events with verifiable outcomes."] },
    { heading: "3. Resolution", paragraphs: ["Markets settle per declared source. Disputes may be manually reviewed."] },
    { heading: "4. Prohibited Topics", paragraphs: ["See the Prohibited Markets Policy for restricted categories."] },
  ],
};

const EC_MARKET_RULES: PolicyDocument = {
  ...US_MARKET_RULES,
  jurisdiction: "EC",
  sections: [
    ...US_MARKET_RULES.sections.slice(0, 3),
    { heading: "4. Ecuador Restrictions", paragraphs: ["Sports markets may be restricted from public discovery. Sensitive categories require manual review before availability."] },
  ],
};

const US_AML: PolicyDocument = {
  kind: "aml_kyc",
  jurisdiction: "US",
  title: "AML and KYC Policy",
  route: "/aml-kyc",
  lastUpdated: "June 22, 2026",
  seoDescription: "US AML and KYC policy for live wallet users.",
  sections: [
    { heading: "1. Identity Verification", paragraphs: ["Live wallet features require verified identity via Stripe Identity or Connect."] },
    { heading: "2. Monitoring", paragraphs: ["We monitor for suspicious patterns and may restrict accounts pending review."] },
    { heading: "3. Records", paragraphs: ["Records may be retained for fraud prevention and regulatory obligations."] },
  ],
};

const EC_AML: PolicyDocument = {
  kind: "aml_kyc",
  jurisdiction: "EC",
  title: "AML and KYC Policy",
  route: "/aml-kyc",
  lastUpdated: "June 22, 2026",
  seoDescription: "Ecuador AML/KYC posture for live wallet and payment rails.",
  sections: [
    { heading: "1. Identity Verification", paragraphs: ["Real-money activity requires verified identity through approved providers (Stripe Identity, Stripe Connect)."] },
    { heading: "2. UAFE-Ready Monitoring", paragraphs: ["We log transaction activity, flag unusual patterns, and maintain evidence exports for counsel and regulators."] },
    { heading: "3. Large Transactions", paragraphs: ["Activity at or above USD 10,000 equivalent may trigger enhanced review."] },
    { heading: "4. Restricted Users", paragraphs: ["Users who fail verification or appear on sanctions lists may not access live wallet features."] },
  ],
};

const US_PROHIBITED: PolicyDocument = {
  kind: "prohibited_markets",
  jurisdiction: "US",
  title: "Prohibited Markets Policy",
  route: "/prohibited-markets",
  lastUpdated: "June 22, 2026",
  seoDescription: "Prohibited market categories under the US framework.",
  sections: [
    { heading: "1. Prohibited Categories", paragraphs: ["The following are prohibited:"], bullets: ["Violence, death, or harm", "Individual health or personal safety", "National security or active conflict", "Active court cases without review"] },
    { heading: "2. Restricted Categories", paragraphs: ["Politics, finance-adjacent, and sports markets may require manual review."] },
    { heading: "3. Enforcement", paragraphs: ["Violations may result in market voiding and account restrictions."] },
  ],
};

const EC_PROHIBITED: PolicyDocument = {
  kind: "prohibited_markets",
  jurisdiction: "EC",
  title: "Prohibited Markets Policy",
  route: "/prohibited-markets",
  lastUpdated: "June 22, 2026",
  seoDescription: "Prohibited market categories under the Ecuador framework.",
  sections: [
    { heading: "1. Prohibited Categories", paragraphs: ["Prohibited in Ecuador framework:"], bullets: ["Violence, death, or harm to individuals", "Individual health or personal safety", "National security or active armed conflict", "High-risk elections without legal review"] },
    { heading: "2. Restricted Categories", paragraphs: ["Sports, politics, and finance-adjacent markets require manual review and may be excluded from public discovery during Ecuador framework development."] },
    { heading: "3. Enforcement", paragraphs: ["Prohibited markets may be frozen or voided. Repeat violations may result in account termination."] },
  ],
};

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

export function getPolicyDocuments(jurisdiction: ComplianceJurisdiction = DEFAULT_JURISDICTION) {
  return POLICY_DOCUMENTS_BY_JURISDICTION[jurisdiction];
}

export function getPolicyDocument(
  kind: PolicyKind,
  jurisdiction: ComplianceJurisdiction = DEFAULT_JURISDICTION,
): PolicyDocument {
  return POLICY_DOCUMENTS_BY_JURISDICTION[jurisdiction][kind];
}

export function getPolicyByRoute(
  route: string,
  jurisdiction: ComplianceJurisdiction = DEFAULT_JURISDICTION,
): PolicyDocument | undefined {
  return Object.values(POLICY_DOCUMENTS_BY_JURISDICTION[jurisdiction]).find(
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
