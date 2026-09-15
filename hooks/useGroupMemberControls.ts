import { useCallback, useEffect, useState } from "react";

import { groupService } from "@/services/group.service";
import { settlementGovernanceService } from "@/services/settlement-governance.service";
import type { SettlementOverrideStatus } from "@/types/settlement-governance";

export function useGroupMemberControls(groupId: string | undefined, userId?: string) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<SettlementOverrideStatus>("none");

  const refresh = useCallback(async () => {
    if (!groupId || !userId) {
      setIsAdmin(false);
      return;
    }
    const members = await groupService.getGroupMembers(groupId);
    const self = members.find((m) => m.user_id === userId);
    setIsAdmin(self?.role === "admin");
  }, [groupId, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadOverrideForMarket = useCallback(async (marketId: string) => {
    const status = await settlementGovernanceService.getSettlementOverrideStatus(marketId);
    setOverrideStatus(status);
    return status;
  }, []);

  return {
    isAdmin,
    overrideStatus,
    refresh,
    loadOverrideForMarket,
    submitRating: settlementGovernanceService.submitAdminRating,
    reportMisconduct: settlementGovernanceService.reportAdminMisconduct,
  };
}
