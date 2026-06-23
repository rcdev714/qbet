import type { ComplianceJurisdiction } from "../compliance/jurisdiction";
import type { PolicyKind } from "../compliance/policy";

export type PolicyInlineNode =
  | { type: "text"; value: string }
  | { type: "policy"; kind: PolicyKind; label: string }
  | { type: "external"; label: string; url: string }
  | { type: "email"; label: string; address: string };

export type PolicyRichText = string | PolicyInlineNode | PolicyInlineNode[];

export type FrameworkReference = {
  label: string;
  url: string;
  description?: string;
};

export const OFFICIAL_URLS = {
  appleAppStoreGuidelines:
    "https://developer.apple.com/app-store/review/guidelines/",
  stripeConsumerTerms: "https://stripe.com/legal/consumer",
  stripePrivacy: "https://stripe.com/privacy",
  stripeIdentity: "https://stripe.com/identity",
  supabasePrivacy: "https://supabase.com/privacy",
  supabaseDpa: "https://supabase.com/legal/dpa",
  fincenBsa: "https://www.fincen.gov/resources/statutes-and-regulations/bank-secrecy-act",
  ofacSanctions: "https://ofac.treasury.gov/",
  ccpaOverview: "https://oag.ca.gov/privacy/ccpa",
  aaaConsumerArbitration: "https://www.adr.org/industries/consumer/",
  ecuadorLopdp: "https://spdp.gob.ec/",
  ecuadorUafe: "https://www.uafe.gob.ec/",
} as const;

export const LEGAL_FRAMEWORK_REFERENCES: Record<
  ComplianceJurisdiction,
  FrameworkReference[]
> = {
  US: [
    {
      label: "FinCEN Bank Secrecy Act overview",
      url: OFFICIAL_URLS.fincenBsa,
      description: "US anti-money laundering and recordkeeping framework.",
    },
    {
      label: "OFAC sanctions programs",
      url: OFFICIAL_URLS.ofacSanctions,
      description: "US sanctions screening and restricted-person controls.",
    },
    {
      label: "California Consumer Privacy Act (CCPA) overview",
      url: OFFICIAL_URLS.ccpaOverview,
      description: "State privacy rights where applicable to US users.",
    },
    {
      label: "AAA Consumer Arbitration Rules",
      url: OFFICIAL_URLS.aaaConsumerArbitration,
      description: "Dispute resolution framework referenced in US Terms.",
    },
  ],
  EC: [
    {
      label: "Superintendencia de Protección de Datos Personales (LOPDP)",
      url: OFFICIAL_URLS.ecuadorLopdp,
      description: "Ecuador data protection authority and LOPDP oversight.",
    },
    {
      label: "UAFE (Unidad de Análisis Financiero y Económico)",
      url: OFFICIAL_URLS.ecuadorUafe,
      description: "Ecuador financial intelligence and AML oversight.",
    },
  ],
};

export const SHARED_PROVIDER_REFERENCES: FrameworkReference[] = [
  {
    label: "Apple App Store Review Guidelines",
    url: OFFICIAL_URLS.appleAppStoreGuidelines,
    description: "User-generated content and safety requirements for mobile apps.",
  },
  {
    label: "Stripe Consumer Terms of Service",
    url: OFFICIAL_URLS.stripeConsumerTerms,
    description: "Payment, payout, and wallet provider terms.",
  },
  {
    label: "Stripe Privacy Policy",
    url: OFFICIAL_URLS.stripePrivacy,
    description: "How Stripe processes payment and identity data.",
  },
  {
    label: "Stripe Identity",
    url: OFFICIAL_URLS.stripeIdentity,
    description: "Identity verification provider used for KYC flows.",
  },
  {
    label: "Supabase Privacy Policy",
    url: OFFICIAL_URLS.supabasePrivacy,
    description: "Infrastructure and database hosting privacy practices.",
  },
  {
    label: "Supabase Data Processing Addendum",
    url: OFFICIAL_URLS.supabaseDpa,
    description: "Processor terms for hosted application data.",
  },
];

export function txt(value: string): PolicyInlineNode {
  return { type: "text", value };
}

export function policyLink(kind: PolicyKind, label: string): PolicyInlineNode {
  return { type: "policy", kind, label };
}

export function externalLink(label: string, url: string): PolicyInlineNode {
  return { type: "external", label, url };
}

export function emailLink(label: string, address: string): PolicyInlineNode {
  return { type: "email", label, address };
}

export function joinNodes(...nodes: PolicyInlineNode[]): PolicyInlineNode[] {
  return nodes;
}

export function frameworkBullets(
  jurisdiction: ComplianceJurisdiction,
  focus: "privacy" | "aml" | "terms" | "general",
): PolicyRichText[] {
  const jurisdictionRefs = LEGAL_FRAMEWORK_REFERENCES[jurisdiction];

  let providerRefs = SHARED_PROVIDER_REFERENCES;
  if (focus === "privacy") {
    providerRefs = SHARED_PROVIDER_REFERENCES.filter(
      (ref) => ref.url.includes("stripe.com/privacy") || ref.url.includes("supabase.com"),
    );
  } else if (focus === "aml") {
    providerRefs = SHARED_PROVIDER_REFERENCES.filter(
      (ref) =>
        ref.url.includes("stripe.com/identity") || ref.url.includes("stripe.com/legal"),
    );
  } else if (focus === "terms") {
    providerRefs = SHARED_PROVIDER_REFERENCES.filter(
      (ref) =>
        ref.url.includes("apple.com") ||
        ref.url.includes("stripe.com/legal") ||
        ref.url.includes("adr.org"),
    );
  }

  const refs =
    focus === "general"
      ? [...jurisdictionRefs, ...SHARED_PROVIDER_REFERENCES]
      : [...jurisdictionRefs, ...providerRefs];

  return refs.map((ref) =>
    joinNodes(
      externalLink(ref.label, ref.url),
      txt(ref.description ? `: ${ref.description}` : ""),
    ),
  );
}
