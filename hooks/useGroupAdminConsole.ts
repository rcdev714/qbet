import { useCallback, useEffect, useState } from "react";

import { settlementGovernanceService } from "@/services/settlement-governance.service";
import type { GroupAdminConsoleGroup } from "@/types/settlement-governance";

export function useGroupAdminConsole() {
  const [groups, setGroups] = useState<GroupAdminConsoleGroup[]>([]);
  const [hasAcknowledgment, setHasAcknowledgment] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const [ack, list] = await Promise.all([
      settlementGovernanceService.hasGroupAdminAcknowledgment(),
      settlementGovernanceService.getAdminConsoleGroups(),
    ]);
    setHasAcknowledgment(ack);
    setGroups(list);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const acceptDisclaimer = useCallback(async () => {
    const { ok } = await settlementGovernanceService.acceptGroupAdminAcknowledgment();
    if (ok) {
      setHasAcknowledgment(true);
    }
    return ok;
  }, []);

  return {
    groups,
    hasAcknowledgment,
    loading,
    refreshing,
    refresh,
    acceptDisclaimer,
    setRefreshing,
  };
}
