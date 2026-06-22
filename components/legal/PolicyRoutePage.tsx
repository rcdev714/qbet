import { PolicyDocumentScreen } from "@/components/legal/PolicyDocumentScreen";
import type { ComplianceJurisdiction } from "@/lib/compliance/jurisdiction";
import { DEFAULT_JURISDICTION } from "@/lib/compliance/jurisdiction";
import type { PolicyKind } from "@/lib/compliance/policy";
import { getPolicyDocument } from "@/lib/legal/policy-content";
import { useLocalSearchParams } from "expo-router";

function parseJurisdiction(value: string | string[] | undefined): ComplianceJurisdiction {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "EC" ? "EC" : DEFAULT_JURISDICTION;
}

export function PolicyRoutePage({ kind }: { kind: PolicyKind }) {
  const params = useLocalSearchParams<{ jurisdiction?: string }>();
  const jurisdiction = parseJurisdiction(params.jurisdiction);
  const document = getPolicyDocument(kind, jurisdiction);
  return <PolicyDocumentScreen document={document} />;
}
