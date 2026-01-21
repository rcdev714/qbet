import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import type { GroupMember, GroupSummary, Invite } from "../types/group";

export interface CreateGroupData {
  name: string;
  description?: string;
  avatar_url?: string;
}

export interface CreateInviteData {
  groupId: string;
  expiresAt?: Date;
}

/**
 * Group service
 * Handles PRIVATE prediction market groups and member management.
 *
 * PRIVATE MARKETS:
 * - Visible only to group members
 * - Created by group members via marketService.createMarket()
 * - Only group members can place bets
 * - group_id is set, is_public is FALSE
 *
 * @see feedService for PUBLIC markets open to all users
 * @see marketService for creating markets within groups
 */
export const groupService = {
  /**
   * Create a new group
   */
  async createGroup(
    data: CreateGroupData,
  ): Promise<{ group: GroupSummary | null; error: Error | null }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { group: null, error: new Error("Not authenticated") };
      }

      const { data: group, error } = await supabase
        .from("groups")
        .insert({
          name: data.name,
          description: data.description || null,
          admin_id: user.id,
        })
        // Explicitly select safe columns (share_code may be column-restricted).
        .select("id,name,description,admin_id,created_at,avatar_url")
        .single();

      if (error || !group) {
        return {
          group: null,
          error: error || new Error("Failed to create group"),
        };
      }

      // Add creator as member
      const { error: memberError } = await supabase.from("group_members")
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: "admin",
        });

      if (memberError) {
        console.error(
          "[groupService] Failed to add creator as member:",
          memberError,
        );
      } else {
        console.log("[groupService] Added creator as group member:", group.id);
      }

      return { group: group as GroupSummary, error: null };
    } catch (error) {
      return { group: null, error: error as Error };
    }
  },

  /**
   * Update a group's info
   */
  async updateGroup(
    groupId: string,
    data: Partial<CreateGroupData>,
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from("groups")
        .update(data)
        .eq("id", groupId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  /**
   * Get a group by ID
   */
  async getGroup(groupId: string): Promise<GroupSummary | null> {
    try {
      const { data: group, error } = await supabase
        .from("groups")
        // Do not select share_code here; it's admin-only.
        .select("id,name,description,admin_id,created_at,avatar_url")
        .eq("id", groupId)
        .single();

      if (error || !group) {
        return null;
      }

      return group as GroupSummary;
    } catch (error) {
      console.error("Error fetching group:", error);
      return null;
    }
  },

  /**
   * Get the group's share code (admin only)
   */
  async getGroupShareCode(
    groupId: string,
  ): Promise<{ shareCode: string | null; error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc("get_group_share_code", {
        p_group_id: groupId,
      });

      if (error) throw error;
      return { shareCode: data ?? null, error: null };
    } catch (error) {
      return { shareCode: null, error: error as Error };
    }
  },

  /**
   * Join a group using its unique 4-character share code
   */
  async joinGroupByCode(
    code: string,
  ): Promise<{ membership: GroupMember | null; error: Error | null }> {
    try {
      const { data: membership, error } = await supabase.rpc(
        "join_group_by_code",
        {
          p_code: code.toUpperCase().trim(),
        },
      );

      if (error) throw error;
      return { membership: membership as GroupMember, error: null };
    } catch (error) {
      return { membership: null, error: error as Error };
    }
  },

  /**
   * Promote a member to admin role
   */
  async promoteMember(
    groupId: string,
    userId: string,
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from("group_members")
        .update({ role: "admin" })
        .eq("group_id", groupId)
        .eq("user_id", userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  /**
   * Remove a member from a group (admin only)
   */
  async removeMember(
    groupId: string,
    userId: string,
  ): Promise<{ error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc("remove_group_member", {
        p_group_id: groupId,
        p_user_id: userId,
      });

      if (error) throw error;
      if (data !== true) throw new Error("Failed to remove member");
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  /**
   * Delete a group and associated data (admin only)
   */
  async deleteGroup(groupId: string): Promise<{ error: Error | null }> {
    try {
      const { data, error } = await supabase.rpc("delete_group", {
        p_group_id: groupId,
      });

      if (error) throw error;
      if (data !== true) throw new Error("Failed to delete group");
      return { error: null };
    } catch (error) {
      const err = error as any;
      // Friendly message for "cannot delete with active markets" (migration raises 22023)
      if (
        err?.code === "22023" ||
        String(err?.message || "").includes("predictions are active")
      ) {
        return {
          error: new Error(
            "All bets must be resolved before deleting this group.",
          ),
        };
      }
      return { error: err as Error };
    }
  },

  /**
   * Get all groups the current user is a member of
   */
  async getUserGroups(): Promise<GroupSummary[]> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return [];
      }

      const { data: groups, error } = await supabase
        .from("group_members")
        .select(
          `
          group_id,
          groups (id,name,description,admin_id,created_at,avatar_url)
        `,
        )
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user groups:", error);
        return [];
      }

      return (groups || [])
        .map(
          (
            item: {
              group_id: string;
              groups:
                | Pick<
                  Database["public"]["Tables"]["groups"]["Row"],
                  | "id"
                  | "name"
                  | "description"
                  | "admin_id"
                  | "created_at"
                  | "avatar_url"
                >
                | null;
            },
          ) => {
            const group = item.groups;
            if (!group) return null;
            return group as GroupSummary;
          },
        )
        .filter((group): group is GroupSummary => group !== null);
    } catch (error) {
      console.error("Error fetching user groups:", error);
      return [];
    }
  },

  /**
   * Get members of a group
   */
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    try {
      const { data: members, error } = await supabase
        .from("group_members")
        .select(
          `
          *,
          users (*)
        `,
        )
        .eq("group_id", groupId);

      if (error) {
        console.error("Error fetching group members:", error);
        return [];
      }

      return (members || []) as GroupMember[];
    } catch (error) {
      console.error("Error fetching group members:", error);
      return [];
    }
  },

  /**
   * Create an invite code for a group
   */
  async createInvite(
    data: CreateInviteData,
  ): Promise<{ invite: Invite | null; error: Error | null }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return { invite: null, error: new Error("Not authenticated") };
      }

      // Generate a random invite code
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();

      const { data: invite, error } = await supabase
        .from("invites")
        .insert({
          group_id: data.groupId,
          created_by: user.id,
          code,
          expires_at: data.expiresAt?.toISOString(),
        })
        .select()
        .single();

      if (error || !invite) {
        return {
          invite: null,
          error: error || new Error("Failed to create invite"),
        };
      }

      return { invite: invite as Invite, error: null };
    } catch (error) {
      return { invite: null, error: error as Error };
    }
  },

  /**
   * Accept an invite code to join a group
   */
  async acceptInvite(
    code: string,
  ): Promise<{ membership: GroupMember | null; error: Error | null }> {
    try {
      const { data: membership, error } = await supabase.rpc("accept_invite", {
        p_code: code,
      });

      if (error) {
        return { membership: null, error };
      }

      return { membership: membership as GroupMember, error: null };
    } catch (error) {
      return { membership: null, error: error as Error };
    }
  },

  /**
   * Get invites for a group
   */
  async getGroupInvites(groupId: string): Promise<Invite[]> {
    try {
      const { data: invites, error } = await supabase
        .from("invites")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching group invites:", error);
        return [];
      }

      return (invites || []) as Invite[];
    } catch (error) {
      console.error("Error fetching group invites:", error);
      return [];
    }
  },

  /**
   * Get a group with its latest markets
   */
  async getGroupWithMarkets(
    groupId: string,
  ): Promise<{ group: GroupSummary; markets: any[] } | null> {
    try {
      const group = await this.getGroup(groupId);
      if (!group) return null;

      const { data: markets } = await supabase
        .from("markets")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(10);

      return {
        group,
        markets: markets || [],
      };
    } catch (error) {
      console.error("Error fetching group with markets:", error);
      return null;
    }
  },

  /**
   * Get aggregated market statistics for a group
   */
  async getGroupMarketStats(
    groupId: string,
  ): Promise<
    { totalMarkets: number; activeMarkets: number; totalPool: number }
  > {
    try {
      const { data: markets, error } = await supabase
        .from("markets")
        .select("id, status, options(total_pool)")
        .eq("group_id", groupId);

      if (error || !markets) {
        return { totalMarkets: 0, activeMarkets: 0, totalPool: 0 };
      }

      const totalMarkets = markets.length;
      const activeMarkets = markets.filter((m) => m.status === "open").length;

      let totalPool = 0;
      markets.forEach((m) => {
      });

      return {
        totalMarkets,
        activeMarkets,
        totalPool,
      };
    } catch (error) {
      console.error("Error getting group stats:", error);
      return { totalMarkets: 0, activeMarkets: 0, totalPool: 0 };
    }
  },
};
