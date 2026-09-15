import { PolicyDocumentScreen } from "@/components/legal/PolicyDocumentScreen";
import { usePolicyFramework } from "@/contexts/PolicyFrameworkContext";
import { getGroupSettlementDisclosureDocument } from "@/lib/legal/group-settlement-disclosure";
import React from "react";

export default function GroupSettlementsPolicyScreen() {
  const { viewJurisdiction } = usePolicyFramework();
  const document = getGroupSettlementDisclosureDocument(viewJurisdiction);
  return <PolicyDocumentScreen document={document} />;
}
