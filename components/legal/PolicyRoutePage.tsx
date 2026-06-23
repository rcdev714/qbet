import { PolicyDocumentScreen } from "@/components/legal/PolicyDocumentScreen";
import { useAppLocale } from "@/contexts/LocaleContext";
import { usePolicyFramework } from "@/contexts/PolicyFrameworkContext";
import type { ComplianceJurisdiction } from "@/lib/compliance/jurisdiction";
import type { PolicyKind } from "@/lib/compliance/policy";
import { getPolicyDocument } from "@/lib/legal/policy-content";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

function parseJurisdiction(value: string | string[] | undefined): ComplianceJurisdiction | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "EC" || raw === "US") return raw;
  return null;
}

export function PolicyRoutePage({ kind }: { kind: PolicyKind }) {
  const params = useLocalSearchParams<{ jurisdiction?: string }>();
  const router = useRouter();
  const { countryCode, locale } = useAppLocale();
  const { viewJurisdiction, setViewJurisdiction } = usePolicyFramework();
  const paramJurisdiction = parseJurisdiction(params.jurisdiction);
  const initializedFromParams = useRef(false);

  useEffect(() => {
    if (initializedFromParams.current || !paramJurisdiction) return;
    setViewJurisdiction(paramJurisdiction);
    initializedFromParams.current = true;
  }, [paramJurisdiction, setViewJurisdiction]);

  useEffect(() => {
    router.setParams({ jurisdiction: viewJurisdiction });
  }, [router, viewJurisdiction]);

  const document = getPolicyDocument(kind, viewJurisdiction, countryCode, locale);
  return <PolicyDocumentScreen document={document} />;
}
