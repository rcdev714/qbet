import { PolicyDocumentScreen } from "@/components/legal/PolicyDocumentScreen";
import { usePolicyFramework } from "@/contexts/PolicyFrameworkContext";
import { getPlatformIntegrityDisclosureDocument } from "@/lib/legal/platform-integrity-disclosure";
import React from "react";

export default function PlatformIntegrityPolicyScreen() {
  const { viewJurisdiction } = usePolicyFramework();
  const document = getPlatformIntegrityDisclosureDocument(viewJurisdiction);
  return <PolicyDocumentScreen document={document} />;
}
