import { useState, useEffect, useCallback, useRef } from "react";
import { groupService } from "../services/group.service";
import { supabase } from "../lib/supabase";
import type { GroupSummary } from "../types/group";

export function useGroups() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      // Only show loading on initial load, not on real-time updates
      if (isInitialLoad.current) {
        setLoading(true);
      }
      const groupsData = await groupService.getUserGroups();
      setGroups(groupsData);
      setError(null);
      isInitialLoad.current = false;
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Real-time subscription for group membership changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-groups-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "group_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Silently refresh when membership changes
          refresh();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId, refresh]);

  const createGroup = async (name: string, description?: string) => {
    // Optimistic update: add temp group immediately
    const tempId = `temp-${Date.now()}`;
    const tempGroup: GroupSummary = {
      id: tempId,
      name,
      description: description || null,
      admin_id: userId || "",
      created_at: new Date().toISOString(),
      avatar_url: null,
    };
    console.log("[useGroups] Optimistic add:", tempGroup);
    setGroups((prev) => {
      console.log("[useGroups] Groups before optimistic:", prev.length);
      const newGroups = [tempGroup, ...prev];
      console.log("[useGroups] Groups after optimistic:", newGroups.length);
      return newGroups;
    });

    const { group, error: createError } = await groupService.createGroup({
      name,
      description,
    });

    console.log("[useGroups] Server response:", { group, error: createError });

    if (group && !createError) {
      // Replace temp group with real one
      console.log("[useGroups] Replacing temp with real group:", group.id);
      setGroups((prev) =>
        prev.map((g) => (g.id === tempId ? (group as GroupSummary) : g))
      );
    } else {
      // Rollback optimistic update on error
      console.log("[useGroups] Rolling back optimistic update");
      setGroups((prev) => prev.filter((g) => g.id !== tempId));
    }
    return { group, error: createError };
  };

  const joinGroup = async (code: string) => {
    const { membership, error: joinError } =
      await groupService.joinGroupByCode(code);
    if (membership && !joinError) {
      // Real-time subscription will catch this, but also refresh for immediate update
      refresh();
    }
    return { membership, error: joinError };
  };

  return {
    groups,
    loading,
    error,
    createGroup,
    joinGroup,
    refresh,
  };
}


export function useGroupMembers(groupId: string | null) {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true);

  const fetchMembers = useCallback(async () => {
    if (!groupId) return;
    if (isInitialLoad.current) {
      setLoading(true);
    }
    const data = await groupService.getGroupMembers(groupId);
    setMembers(data);
    setLoading(false);
    isInitialLoad.current = false;
  }, [groupId]);

  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      setLoading(false);
      return;
    }

    isInitialLoad.current = true;
    fetchMembers();
  }, [groupId, fetchMembers]);

  // Real-time subscription for member changes
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-members-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [groupId, fetchMembers]);

  const promoteToAdmin = async (userId: string) => {
    if (!groupId) return { error: new Error("Missing groupId") };
    const { error } = await groupService.promoteMember(groupId, userId);
    if (!error) fetchMembers();
    return { error };
  };

  const removeMember = async (userId: string) => {
    if (!groupId) return { error: new Error("Missing groupId") };
    const { error } = await groupService.removeMember(groupId, userId);
    if (!error) fetchMembers();
    return { error };
  };

  return { members, loading, refresh: fetchMembers, promoteToAdmin, removeMember };
}

export function useGroup(groupId: string | null) {
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    const loadGroup = async () => {
      try {
        setLoading(true);
        const groupData = await groupService.getGroup(groupId);
        setGroup(groupData);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadGroup();
  }, [groupId]);

  return {
    group,
    loading,
    error,
    refresh: async () => {
      if (!groupId) return;
      const groupData = await groupService.getGroup(groupId);
      setGroup(groupData);
    },
  };
}

