import type { PolicyKind } from "../compliance/policy";
import type { PolicyDocument, PolicySection } from "./policy-content";
import {
    emailLink,
    frameworkBullets,
    joinNodes,
    policyLink,
    txt
} from "./policy-links";

export const US_POLICY_VERSION_ES = "2026-06-24-es-us";
export const US_POLICY_LAST_UPDATED = "24 de junio de 2026";
const SUPPORT_EMAIL = "support@anymarket.app";

const US_COPY_ES = {
  frameworkName: "marco de cumplimiento de Estados Unidos",
  regulatoryPosition:
    "AnyMarket opera como plataforma social de mercados de predicción de eventos futuros bajo un marco de lanzamiento en Estados Unidos. La disponibilidad de funciones de billetera Live puede variar según estado, estatus del usuario, tipo de mercado, rail de pago y aprobación del proveedor.",
  sportsPosition:
    "Los mercados deportivos pueden estar sujetos a revisión adicional, restricciones estatales, limitaciones del feed público o eliminación cuando la Compañía determine que la disponibilidad crearía riesgos legales, de integridad o para consumidores.",
  privacyRights:
    "Según donde viva, puede tener derechos de acceso, corrección, eliminación, portabilidad u oposición a cierto procesamiento de información personal. Atendemos solicitudes legalmente requeridas y podemos conservar registros necesarios para fraude, seguridad, pagos, impuestos, disputas y cumplimiento.",
  amlPosture:
    "Para usuarios en Estados Unidos, AnyMarket mantiene un programa basado en riesgo de AML, sanciones, fraude y cumplimiento de pagos usando verificación de identidad, monitoreo de transacciones, revisiones de actividad restringida, controles de proveedores y retención de registros.",
  disputeForum:
    "Para usuarios en Estados Unidos, las disputas están sujetas a arbitraje vinculante individual, renuncia a juicio con jurado y renuncia a acciones colectivas en la máxima medida permitida por la ley aplicable.",
};

function createPolicyDocument(
  document: Omit<PolicyDocument, "lastUpdated" | "version">,
): PolicyDocument {
  return {
    version: US_POLICY_VERSION_ES,
    lastUpdated: US_POLICY_LAST_UPDATED,
    ...document,
  };
}

function relatedPoliciesSection(currentKind: PolicyKind): PolicySection {
  const labels = {
    terms: "Términos de Servicio",
    privacy: "Política de Privacidad",
    risk_disclosure: "Divulgación de Riesgos",
    market_rules: "Reglas de Mercados",
    aml_kyc: "Política AML y KYC",
    prohibited_markets: "Mercados Prohibidos",
  } satisfies Record<PolicyKind, string>;

  return {
    heading: "Políticas Relacionadas",
    paragraphs: ["Lea también las demás políticas obligatorias del marco de Estados Unidos:"],
    bullets: (Object.keys(labels) as PolicyKind[])
      .filter((kind) => kind !== currentKind)
      .map((kind) => policyLink(kind, labels[kind])),
  };
}

function frameworksSection(focus: "privacy" | "aml" | "terms" | "general"): PolicySection {
  return {
    heading: "Marcos Legales",
    paragraphs: [
      joinNodes(
        txt("Estas políticas se rigen por el "),
        txt(US_COPY_ES.frameworkName),
        txt(". Esta traducción al español es informativa; el marco legal aplicable sigue siendo el de Estados Unidos."),
      ),
    ],
    bullets: frameworkBullets("US", focus),
  };
}

function contactSection(): PolicySection {
  return {
    heading: "Contacto",
    paragraphs: [
      joinNodes(
        txt("Consultas legales, privacidad y cumplimiento: "),
        emailLink(SUPPORT_EMAIL, SUPPORT_EMAIL),
        txt("."),
      ),
    ],
  };
}

const US_TERMS_ES = createPolicyDocument({
  kind: "terms",
  jurisdiction: "US",
  title: "Términos de Servicio",
  route: "/terms",
  seoDescription: "Términos de Servicio de AnyMarket bajo el marco de cumplimiento de Estados Unidos (traducción al español).",
  sections: [
    {
      heading: "Aviso",
      paragraphs: [US_COPY_ES.regulatoryPosition, US_COPY_ES.disputeForum],
    },
    {
      heading: "Naturaleza del Servicio",
      paragraphs: [US_COPY_ES.sportsPosition],
    },
    relatedPoliciesSection("terms"),
    frameworksSection("terms"),
    contactSection(),
  ],
});

const US_PRIVACY_ES = createPolicyDocument({
  kind: "privacy",
  jurisdiction: "US",
  title: "Política de Privacidad",
  route: "/privacy",
  seoDescription: "Política de Privacidad de AnyMarket para el marco de Estados Unidos (español).",
  sections: [
    { heading: "Alcance", paragraphs: [US_COPY_ES.privacyRights] },
    relatedPoliciesSection("privacy"),
    frameworksSection("privacy"),
    contactSection(),
  ],
});

const US_RISK_ES = createPolicyDocument({
  kind: "risk_disclosure",
  jurisdiction: "US",
  title: "Divulgación de Riesgos",
  route: "/risk",
  seoDescription: "Divulgación de riesgos para actividad con dinero real bajo el marco de EE. UU.",
  sections: [
    {
      heading: "Riesgo de pérdida",
      paragraphs: ["La billetera Live involucra dinero real. Puede perder fondos utilizados en mercados."],
    },
    relatedPoliciesSection("risk_disclosure"),
    frameworksSection("general"),
    contactSection(),
  ],
});

const US_MARKET_RULES_ES = createPolicyDocument({
  kind: "market_rules",
  jurisdiction: "US",
  title: "Reglas de Mercados",
  route: "/market-rules",
  seoDescription: "Reglas de creación y resolución bajo el marco de EE. UU.",
  sections: [
    {
      heading: "Estándares",
      bullets: ["Evento futuro verificable", "Resultados objetivos", "Fuente de resolución declarada"],
    },
    relatedPoliciesSection("market_rules"),
    frameworksSection("general"),
    contactSection(),
  ],
});

const US_AML_ES = createPolicyDocument({
  kind: "aml_kyc",
  jurisdiction: "US",
  title: "Política AML y KYC",
  route: "/aml-kyc",
  seoDescription: "Programa AML/KYC de AnyMarket para usuarios del marco de EE. UU.",
  sections: [
    { heading: "Programa", paragraphs: [US_COPY_ES.amlPosture] },
    relatedPoliciesSection("aml_kyc"),
    frameworksSection("aml"),
    contactSection(),
  ],
});

const US_PROHIBITED_ES = createPolicyDocument({
  kind: "prohibited_markets",
  jurisdiction: "US",
  title: "Mercados Prohibidos",
  route: "/prohibited-markets",
  seoDescription: "Categorías prohibidas bajo el marco de EE. UU.",
  sections: [
    {
      heading: "Categorías",
      bullets: ["Violencia o muerte", "Salud individual", "Seguridad nacional", "Contenido ilegal o explotador"],
    },
    relatedPoliciesSection("prohibited_markets"),
    frameworksSection("general"),
    contactSection(),
  ],
});

export const US_SPANISH_POLICY_DOCUMENTS: Record<PolicyKind, PolicyDocument> = {
  terms: US_TERMS_ES,
  privacy: US_PRIVACY_ES,
  risk_disclosure: US_RISK_ES,
  market_rules: US_MARKET_RULES_ES,
  aml_kyc: US_AML_ES,
  prohibited_markets: US_PROHIBITED_ES,
};
