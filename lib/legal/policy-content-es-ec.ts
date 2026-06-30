import type { PolicyKind } from "../compliance/policy";
import type { PolicyDocument, PolicySection } from "./policy-content";
import {
    emailLink,
    externalLink,
    frameworkBullets,
    joinNodes,
    OFFICIAL_URLS,
    policyLink,
    txt,
} from "./policy-links";

export const EC_POLICY_VERSION = "2026-06-22-es-ec";
export const EC_POLICY_LAST_UPDATED = "22 de junio de 2026";
const SUPPORT_EMAIL = "support@anymarkt.com";

export const EC_POLICY_KIND_LABELS_ES: Record<PolicyKind, string> = {
  terms: "Términos de Servicio",
  privacy: "Política de Privacidad",
  risk_disclosure: "Divulgación de Riesgos de Mercados con Dinero Real",
  market_rules: "Reglas de Creación y Resolución de Mercados",
  aml_kyc: "Política AML y KYC",
  prohibited_markets: "Política de Mercados Prohibidos",
};

const EC_COPY_ES = {
  frameworkName: "marco de cumplimiento de Ecuador",
  regulatoryPosition:
    "Anymarkt opera en Ecuador bajo un marco cauteloso de eventos futuros no deportivos. El producto está diseñado como una plataforma de mercados de predicción generados por usuarios y no como un operador público de apuestas deportivas durante la fase de lanzamiento en Ecuador.",
  sportsPosition:
    "Los mercados deportivos están excluidos del descubrimiento público y pueden ser bloqueados, congelados, anulados o retenidos para revisión legal en Ecuador. Las categorías sensibles también requieren revisión manual antes de cualquier disponibilidad pública.",
  privacyRights:
    "Para usuarios en Ecuador, Anymarkt aplica principios alineados con la Ley Orgánica de Protección de Datos Personales, incluyendo transparencia, limitación de finalidad, minimización de datos, seguridad, disciplina de retención y el ejercicio de los derechos legalmente disponibles de acceso, rectificación, eliminación, oposición, suspensión y portabilidad.",
  amlPosture:
    "Para usuarios en Ecuador, Anymarkt mantiene una postura operativa preparada para la UAFE, incluyendo verificación de identidad, screening de sanciones, monitoreo de transacciones, exportaciones de libro mayor, activadores de revisión reforzada y preservación de evidencia para asesores legales, socios de pago y autoridades competentes cuando sea requerido.",
  disputeForum:
    "Para usuarios en Ecuador, las disputas se resolverán mediante los procedimientos y foros disponibles bajo la ley ecuatoriana aplicable, salvo que se presente y el usuario acepte otro proceso lícito de resolución de disputas.",
};

function createPolicyDocument(
  document: Omit<PolicyDocument, "lastUpdated" | "version">,
): PolicyDocument {
  return {
    version: EC_POLICY_VERSION,
    lastUpdated: EC_POLICY_LAST_UPDATED,
    ...document,
  };
}

function relatedPoliciesSection(currentKind: PolicyKind): PolicySection {
  const labels = EC_POLICY_KIND_LABELS_ES;
  const kinds: PolicyKind[] = [
    "terms",
    "privacy",
    "risk_disclosure",
    "market_rules",
    "aml_kyc",
    "prohibited_markets",
  ];
  return {
    heading: "Políticas Relacionadas de Anymarkt",
    paragraphs: [
      "Las siguientes políticas obligatorias forman parte del mismo marco de cumplimiento y deben leerse conjuntamente:",
    ],
    bullets: kinds
      .filter((kind) => kind !== currentKind)
      .map((kind) => policyLink(kind, labels[kind])),
  };
}

function frameworksSection(focus: "privacy" | "aml" | "terms" | "general"): PolicySection {
  return {
    heading: "Marcos Legales y Regulatorios",
    paragraphs: [
      joinNodes(
        txt("Anymarkt está diseñado para alinearse con los marcos legales, regulatorios y de proveedores aplicables bajo el "),
        txt(EC_COPY_ES.frameworkName),
        txt(". Los siguientes recursos oficiales y de proveedores contextualizan nuestra postura de cumplimiento:"),
      ),
    ],
    bullets: frameworkBullets("EC", focus),
  };
}

function contactSection(): PolicySection {
  return {
    heading: "Contacto",
    paragraphs: [
      joinNodes(
        txt("Preguntas, avisos legales, solicitudes de privacidad, reportes de seguridad y consultas de cumplimiento pueden enviarse a "),
        emailLink(SUPPORT_EMAIL, SUPPORT_EMAIL),
        txt("."),
      ),
      "Si nos contacta sobre fraude, compromiso de cuenta, contenido ilegal, autolesión, amenazas o manipulación de mercados, incluya el nombre de usuario, mercado, transacción, mensaje o detalles del reporte relevantes.",
    ],
  };
}

const EC_TERMS_ES = createPolicyDocument({
  kind: "terms",
  jurisdiction: "EC",
  title: "Términos de Servicio",
  route: "/terms",
  seoDescription:
    "Términos de Servicio de Anymarkt para usuarios bajo el marco de cumplimiento de Ecuador.",
  sections: [
    {
      heading: "Aviso Importante",
      paragraphs: [
        joinNodes(
          txt("Estos Términos de Servicio rigen su uso de Anymarkt bajo el "),
          txt(EC_COPY_ES.frameworkName),
          txt(
            ". Constituyen un acuerdo legal entre usted y Anymarkt, incluyendo reglas para el Modo Juego, funciones de billetera Live, contenido generado por usuarios, creación de mercados, prevención de fraude, verificación de identidad, moderación y restricciones de cuenta.",
          ),
        ),
        EC_COPY_ES.disputeForum,
      ],
    },
    {
      heading: "1. Aceptación y Cambios",
      clauses: [
        {
          label: "1.1 Acuerdo.",
          text: "Al crear una cuenta, acceder a la aplicación, ver mercados, publicar contenido, realizar una predicción o usar funciones de billetera, usted acepta estos Términos y las políticas legales obligatorias vinculadas en la aplicación.",
        },
        {
          label: "1.2 Actualizaciones.",
          text: "Podemos actualizar las políticas para reflejar cambios del producto, requisitos legales, controles de seguridad o requisitos de proveedores. Si una versión de política se vuelve obligatoria, puede necesitar revisarla y aceptarla antes de continuar usando funciones restringidas.",
        },
      ],
    },
    {
      heading: "2. Naturaleza del Servicio",
      paragraphs: [EC_COPY_ES.regulatoryPosition, EC_COPY_ES.sportsPosition],
      clauses: [
        {
          label: "2.1 Plataforma social de predicción.",
          text: "Anymarkt permite crear, discutir y participar en mercados de eventos futuros con criterios objetivos de resolución. Los mercados son herramientas sociales e informativas, no asesoramiento financiero, legal, tributario o de inversión personalizado.",
        },
        {
          label: "2.2 Modo Juego.",
          text: "El Modo Juego usa créditos virtuales sin valor en efectivo ni canje por dinero, bienes o servicios.",
        },
        {
          label: "2.3 Billetera Live.",
          text: "Las funciones de billetera Live, cuando estén disponibles, involucran fondos reales y están sujetas a verificación de identidad, reglas de jurisdicción, límites de riesgo y monitoreo continuo.",
        },
      ],
    },
    {
      heading: "3. Elegibilidad y Responsabilidades de la Cuenta",
      clauses: [
        {
          label: "3.1 Edad.",
          text: "Debe tener al menos 17 años y la edad mínima exigida por las leyes aplicables para usar la aplicación y cualquier función de billetera Live.",
        },
        {
          label: "3.2 Información veraz.",
          text: "Debe proporcionar información precisa de cuenta, residencia, pagos, impuestos e identidad. No puede falsear ubicación, identidad, edad, origen de fondos o elegibilidad.",
        },
        {
          label: "3.3 Residencia.",
          text: "Su país de residencia se fija durante la incorporación y determina el marco legal aplicable. Los cambios requieren contactar a soporte.",
        },
      ],
    },
    {
      heading: "4. Prevención de Fraude y Conducta Ilegal",
      paragraphs: [
        "Anymarkt opera un programa de confianza y seguridad para detectar, prevenir, investigar y responder a fraude, manipulación, actividad ilegal, contenido abusivo y daño a usuarios.",
      ],
    },
    {
      heading: "5. Contenido de Usuario y Seguridad Comunitaria",
      clauses: [
        {
          label: "5.1 Tolerancia cero.",
          text: joinNodes(
            txt("No toleramos contenido ilegal, explotador, amenazante, de odio, acoso, sexual explícito, difamatorio, engañoso o que promueva autolesión o violencia, conforme a las "),
            externalLink("Directrices de Revisión de App Store de Apple", OFFICIAL_URLS.appleAppStoreGuidelines),
            txt("."),
          ),
        },
        {
          label: "5.2 Reportes y bloqueos.",
          text: "Puede reportar contenido o usuarios y bloquear usuarios donde la función esté disponible.",
        },
      ],
    },
    {
      heading: "6. Mercados, Resolución y Billetera",
      clauses: [
        {
          label: "6.1 Estándares de mercado.",
          text: "Cada mercado debe identificar un evento futuro de buena fe, resultados objetivos, hora de cierre, fuente de resolución y reglas de liquidación.",
        },
        {
          label: "6.2 Mercados deportivos en Ecuador.",
          text: EC_COPY_ES.sportsPosition,
        },
      ],
    },
    {
      heading: "7. Limitación de Responsabilidad",
      paragraphs: [
        "En la máxima medida permitida por la ley, Anymarkt no es responsable por daños indirectos, incidentales, especiales, consecuentes, pérdida de beneficios, pérdida de datos, pérdidas de mercado, fallas de proveedores o actividad no autorizada que no pudiera prevenirse razonablemente.",
      ],
    },
    relatedPoliciesSection("terms"),
    frameworksSection("terms"),
    contactSection(),
  ],
});

const EC_PRIVACY_ES = createPolicyDocument({
  kind: "privacy",
  jurisdiction: "EC",
  title: "Política de Privacidad",
  route: "/privacy",
  seoDescription: "Política de Privacidad de Anymarkt para usuarios en Ecuador.",
  sections: [
    {
      heading: "1. Alcance",
      paragraphs: [
        joinNodes(
          txt("Esta Política de Privacidad explica cómo Anymarkt recopila, usa, divulga, retiene y protege información bajo el "),
          txt(EC_COPY_ES.frameworkName),
          txt("."),
        ),
        EC_COPY_ES.privacyRights,
      ],
    },
    {
      heading: "2. Datos que Recopilamos",
      bullets: [
        "Datos de cuenta: nombre de usuario, correo, país de residencia, teléfono opcional, configuración.",
        "Datos de verificación y cumplimiento: estado KYC, referencias de proveedor, historial de transacciones, señales de riesgo.",
        "Datos de uso: mercados, predicciones, mensajes, reportes, registros técnicos.",
      ],
    },
    {
      heading: "3. Finalidades del Tratamiento",
      bullets: [
        "Operar la plataforma, mercados, billetera y funciones sociales.",
        "Verificar identidad, prevenir fraude, cumplir obligaciones legales y responder a autoridades.",
        "Mejorar seguridad, integridad de mercados y experiencia del usuario.",
      ],
    },
    {
      heading: "4. Derechos del Titular (LOPDP)",
      paragraphs: [EC_COPY_ES.privacyRights],
    },
    {
      heading: "5. Retención y Seguridad",
      paragraphs: [
        "Conservamos datos según sea necesario para cumplimiento, fraude, pagos, impuestos, disputas y defensa legal. Aplicamos controles técnicos y organizativos razonables.",
      ],
    },
    relatedPoliciesSection("privacy"),
    frameworksSection("privacy"),
    contactSection(),
  ],
});

const EC_RISK_ES = createPolicyDocument({
  kind: "risk_disclosure",
  jurisdiction: "EC",
  title: "Divulgación de Riesgos de Mercados con Dinero Real",
  route: "/risk",
  seoDescription: "Divulgación de riesgos para mercados de predicción no deportivos en Ecuador.",
  sections: [
    {
      heading: "1. Riesgo de Pérdida",
      paragraphs: [
        "Las funciones de billetera Live involucran dinero real. Puede perder la totalidad de los fondos utilizados en un mercado. Los resultados son inciertos.",
      ],
    },
    {
      heading: "2. No es Asesoramiento",
      paragraphs: [
        "Anymarkt no proporciona asesoramiento financiero, legal, tributario o de inversión. Usted es responsable de evaluar mercados, fuentes de resolución y riesgos antes de participar.",
      ],
    },
    {
      heading: "3. Postura Regulatoria en Ecuador",
      paragraphs: [EC_COPY_ES.regulatoryPosition, EC_COPY_ES.sportsPosition],
    },
    {
      heading: "4. Proveedores de Pago",
      paragraphs: [
        "Depósitos, retiros e identidad pueden ser procesados por terceros como Stripe. Los proveedores tienen sus propias reglas y pueden restringir actividad independientemente de Anymarkt.",
      ],
    },
    {
      heading: "5. Restricciones y Suspensiones",
      paragraphs: [
        "Podemos limitar mercados, categorías, montos, jurisdicciones o funciones por cumplimiento, fraude, integridad o requisitos legales.",
      ],
    },
    relatedPoliciesSection("risk_disclosure"),
    frameworksSection("general"),
    contactSection(),
  ],
});

const EC_MARKET_RULES_ES = createPolicyDocument({
  kind: "market_rules",
  jurisdiction: "EC",
  title: "Reglas de Creación y Resolución de Mercados",
  route: "/market-rules",
  seoDescription: "Reglas para crear y resolver mercados bajo el marco de Ecuador.",
  sections: [
    {
      heading: "1. Requisitos de Mercado",
      bullets: [
        "Evento futuro identificable de buena fe.",
        "Resultados mutuamente excluyentes y exhaustivos.",
        "Hora de cierre y fuente de resolución objetiva.",
        "Reglas de liquidación claras.",
      ],
    },
    {
      heading: "2. Categorías y Revisión",
      paragraphs: [EC_COPY_ES.sportsPosition],
      bullets: [
        "Los mercados deportivos no están permitidos para usuarios de Ecuador.",
        "Las categorías restringidas o prohibidas requieren revisión manual o están bloqueadas.",
      ],
    },
    {
      heading: "3. Resolución y Disputas",
      paragraphs: [
        "Los creadores y administradores deben resolver conforme a la fuente declarada. Podemos congelar, retrasar, anular o corregir mercados ambiguos, manipulados o prohibidos.",
      ],
    },
    {
      heading: "4. Integridad",
      bullets: [
        "Prohibida la colusión, wash trading, multi-cuentas, manipulación o información falsa.",
        "Preservamos evidencia para revisión interna, proveedores o autoridades cuando sea requerido.",
      ],
    },
    relatedPoliciesSection("market_rules"),
    frameworksSection("general"),
    contactSection(),
  ],
});

const EC_AML_ES = createPolicyDocument({
  kind: "aml_kyc",
  jurisdiction: "EC",
  title: "Política AML y KYC",
  route: "/aml-kyc",
  seoDescription: "Postura AML/KYC de Anymarkt para billetera Live en Ecuador.",
  sections: [
    {
      heading: "1. Propósito",
      paragraphs: [
        joinNodes(
          txt("Esta política describe el programa basado en riesgo de Anymarkt para verificación de identidad, screening de sanciones, monitoreo de transacciones y escalamiento bajo el "),
          txt(EC_COPY_ES.frameworkName),
          txt("."),
        ),
        EC_COPY_ES.amlPosture,
      ],
    },
    {
      heading: "2. Verificación de Identidad",
      bullets: [
        joinNodes(
          txt("La billetera Live puede requerir verificación mediante proveedores aprobados como "),
          externalLink("Stripe Identity", OFFICIAL_URLS.stripeIdentity),
          txt("."),
        ),
        "Podemos exigir reverificación cuando cambien documentos, riesgo, residencia o reglas del proveedor.",
      ],
    },
    {
      heading: "3. Monitoreo y Retención",
      bullets: [
        "Patrones inusuales de depósitos, retiros, transferencias, predicciones y liquidaciones.",
        "Señales de fraude, sanciones, chargebacks o evasión de controles.",
        "Conservación de registros para cumplimiento, auditoría e investigaciones.",
      ],
    },
    {
      heading: "4. Escalamiento",
      paragraphs: [
        joinNodes(
          txt("Cuando sea requerido o apropiado, Anymarkt puede preservar evidencia y escalar actividad sospechosa a asesores legales, auditores, reguladores o autoridades competentes, incluyendo la "),
          externalLink("UAFE", OFFICIAL_URLS.ecuadorUafe),
          txt(" cuando corresponda."),
        ),
      ],
    },
    relatedPoliciesSection("aml_kyc"),
    frameworksSection("aml"),
    contactSection(),
  ],
});

const EC_PROHIBITED_ES = createPolicyDocument({
  kind: "prohibited_markets",
  jurisdiction: "EC",
  title: "Política de Mercados Prohibidos",
  route: "/prohibited-markets",
  seoDescription: "Categorías de mercados prohibidas bajo el marco de Ecuador.",
  sections: [
    {
      heading: "1. Categorías Prohibidas",
      bullets: [
        "Violencia, muerte o daño a personas.",
        "Salud individual o seguridad personal.",
        "Seguridad nacional o conflictos armados.",
        "Contenido ilegal, explotador o que incentive daño.",
      ],
    },
    {
      heading: "2. Categorías Restringidas",
      bullets: [
        "Deportes: no permitidos para usuarios de Ecuador en cualquier canal.",
        "Finanzas, política y elecciones de alto riesgo: revisión manual obligatoria.",
      ],
    },
    {
      heading: "3. Cumplimiento Técnico",
      paragraphs: [
        "Las restricciones se aplican en el backend y en la interfaz mediante revisión de mercados, gates de cumplimiento, detección automatizada de texto relacionado con deportes (equipos, ligas, partidos, torneos y frases equivalentes) y bloqueos de categoría deportiva (`ec_sports_market_blocked`, `ec_sports_content_detected`). Los usuarios de Ecuador no pueden crear, descubrir ni apostar en mercados deportivos aunque elijan otra categoría.",
      ],
    },
    {
      heading: "4. Consecuencias",
      paragraphs: [
        "Los mercados prohibidos pueden ser rechazados, congelados, anulados o eliminados. Las cuentas pueden ser restringidas o terminadas.",
      ],
    },
    relatedPoliciesSection("prohibited_markets"),
    frameworksSection("general"),
    contactSection(),
  ],
});

export const EC_SPANISH_POLICY_DOCUMENTS: Record<PolicyKind, PolicyDocument> = {
  terms: EC_TERMS_ES,
  privacy: EC_PRIVACY_ES,
  risk_disclosure: EC_RISK_ES,
  market_rules: EC_MARKET_RULES_ES,
  aml_kyc: EC_AML_ES,
  prohibited_markets: EC_PROHIBITED_ES,
};

export function getSpanishPolicyDocuments(): PolicyDocument[] {
  return Object.values(EC_SPANISH_POLICY_DOCUMENTS);
}
