import { useEffect, useMemo, useState } from "react";

import { useAuthContext } from "@/contexts/AuthContext";
import { useGroups } from "@/hooks/useGroups";
import { isPersistedGroupId } from "@/lib/group-id";
import { betService } from "@/services/bet.service";
import type { GroupSummary } from "@/types/group";

const PINNED_GROUP_LIMIT = 2;

export function useDesktopSidebarShortcuts() {
  const { user } = useAuthContext();
  const { groups, loading: groupsLoading } = useGroups();
  const [activeBets, setActiveBets] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setActiveBets(0);
      return;
    }

    let cancelled = false;

    betService.getUserBetSummary(user.id).then((summary) => {
      if (!cancelled) setActiveBets(summary.activeBets);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const pinnedGroups = useMemo(() => {
    return [...groups]
      .filter((group) => isPersistedGroupId(group.id))
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, PINNED_GROUP_LIMIT) as GroupSummary[];
  }, [groups]);

  return {
    pinnedGroups,
    activeBets,
    groupsLoading,
    isAuthenticated: Boolean(user),
  };
}
