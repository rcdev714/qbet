import { decode } from "base64-arraybuffer";

import { isMissingRpcError } from "../lib/social/feed-visibility";
import {
  groupAvatarExtension,
  parseGroupCodePreview,
  privacyColumns,
  type GroupCodePreview,
  type GroupPrivacyChoice,
} from "../lib/social/group-join";
import { GROUP_MEMBERS_WITH_GROUP_SELECT, GROUP_MEMBERS_WITH_USER_SELECT } from "../lib/supabase-embeds";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import type { GroupMember, GroupSummary, Invite } from "../types/group";

export interface CreateGroupData {
  name: string;
  description?: string;
  avatar_url?: string;
}

export interface GroupAvatarUpload {
  base64: string;
  mimeType?: string | null;
  uri: string;
}

export interface CreateSocialGroupInput {
  name: string;
  description?: string;
  privacy: GroupPrivacyChoice;
  avatar?: GroupAvatarUpload | null;
}

export interface CreateSocialGroupResult {
  group: GroupSummary | null;
  error: Error | null;
  privacyError: Error | null;
  avatarError: Error | null;
}

export interface CreateInviteData {
  groupId: string;
  expiresAt?: Date;
}

export interface ProfileGroup {
  group_id: string;
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  member_count: number;
  active_market_count: number;
  is_member: boolean;
}

export interface AdministeredGroup extends ProfileGroup {
  is_discoverable: boolean;
  show_on_profile: boolean;
  created_at: string;
  pending_dispute_count?: number;
  avg_admin_score?: number | null;
  platform_override_active?: boolean;
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
   * Create a group, then apply the phone sheet's photo and privacy.
   * The creator membership stays role admin. Invite-only clears both
   * discoverable flags; profile listing leaves the column defaults.
   */
  async createSocialGroup(input: CreateSocialGroupInput): Promise<CreateSocialGroupResult> {
    const name = input.name.trim();
    if (!name) {
      return { group: null, error: new Error("Name is required"), privacyError: null, avatarError: null };
    }
    const created = await groupService.createGroup({
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
    });
    if (created.error || !created.group) {
      return { group: null, error: created.error ?? new Error("Failed to create group"), privacyError: null, avatarError: null };
    }

    let group = created.group;
    let privacyError: Error | null = null;
    let avatarError: Error | null = null;
    const flags = privacyColumns(input.privacy);

    if (!flags.isDiscoverable || !flags.showOnProfile) {
      const visibility = await groupService.updateGroupVisibility(group.id, {
        is_discoverable: flags.isDiscoverable,
        show_on_profile: flags.showOnProfile,
      });
      privacyError = visibility.error;
    }

    if (input.avatar?.base64) {
      const uploaded = await groupService.uploadGroupAvatar(group.id, input.avatar);
      if (uploaded.publicUrl) {
        const saved = await groupService.updateGroup(group.id, { avatar_url: uploaded.publicUrl });
        if (saved.error) {
          avatarError = saved.error;
        } else {
          group = { ...group, avatar_url: uploaded.publicUrl };
        }
      } else {
        avatarError = uploaded.error ?? new Error("Failed to upload group photo");
      }
    }

    return { group, error: null, privacyError, avatarError };
  },

  async uploadGroupAvatar(
    groupId: string,
    asset: GroupAvatarUpload,
  ): Promise<{ publicUrl: string | null; error: Error | null }> {
    try {
      if (!asset.base64) return { publicUrl: null, error: new Error("No image data found") };
      const arrayBuffer = decode(asset.base64);
      const ext = groupAvatarExtension(asset.uri, asset.mimeType);
      const fileName = `group-avatars/${groupId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, arrayBuffer, {
        contentType: asset.mimeType ?? "image/jpeg",
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
      return { publicUrl, error: null };
    } catch (error) {
      return { publicUrl: null, error: error as Error };
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
   * Look up a group by its 6-character share code without joining.
   * An unknown code is an empty preview, not an error. A missing RPC
   * is reported separately so the sheet can still offer Join.
   */
  async previewGroupByCode(
    code: string,
  ): Promise<{ preview: GroupCodePreview | null; error: Error | null; missing: boolean }> {
    try {
      const { data, error } = await supabase.rpc("preview_group_by_code", {
        p_code: code.trim().toUpperCase(),
      });
      if (error) {
        if (isMissingRpcError(error)) return { preview: null, error: null, missing: true };
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return { preview: parseGroupCodePreview(row), error: null, missing: false };
    } catch (error) {
      return { preview: null, error: error as Error, missing: false };
    }
  },

  /**
   * Join a group using its 6-character share code.
   * An existing member is returned unchanged; the RPC does not demote admins.
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
        .select(GROUP_MEMBERS_WITH_GROUP_SELECT)
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
        .select(GROUP_MEMBERS_WITH_USER_SELECT)
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
        .select("id, status")
        .eq("group_id", groupId);

      if (error || !markets) {
        return { totalMarkets: 0, activeMarkets: 0, totalPool: 0 };
      }

      const totalMarkets = markets.length;
      const activeMarkets = markets.filter((m) => {
        const status = String(m.status ?? "");
        return status === "open" || status === "active";
      }).length;
      const marketIds = markets.map((market) => market.id);

      let totalPool = 0;
      if (marketIds.length > 0) {
        const { data: options, error: optionsError } = await supabase
          .from("options")
          .select("total_pool, yes_pool, no_pool")
          .in("market_id", marketIds);

        if (!optionsError && options) {
          options.forEach((option) => {
            const total = Number(option.total_pool ?? 0);
            const yes = Number(option.yes_pool ?? 0);
            const no = Number(option.no_pool ?? 0);
            const value = total > 0 ? total : yes + no;
            if (Number.isFinite(value)) totalPool += value;
          });
        }
      }

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

  async sendGroupInviteByEmail(
    groupId: string,
    email: string,
  ): Promise<{ ok: boolean; error: Error | null }> {
    try {
      const { data, error } = await supabase.functions.invoke("send-group-invite-email", {
        body: { groupId, email },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      return { ok: true, error: null };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  },

  async getAdministeredGroups(): Promise<AdministeredGroup[]> {
    try {
      const { data, error } = await (supabase as any).rpc("get_groups_administered");
      if (error) throw error;
      return (data ?? []) as AdministeredGroup[];
    } catch (error) {
      console.error("Error fetching administered groups:", error);
      return [];
    }
  },

  async getProfileGroups(userId: string): Promise<ProfileGroup[]> {
    try {
      const { data, error } = await (supabase as any).rpc("get_user_profile_groups", {
        p_user_id: userId,
      });
      if (error) throw error;
      return (data ?? []) as ProfileGroup[];
    } catch (error) {
      console.error("Error fetching profile groups:", error);
      return [];
    }
  },

  async joinGroupFromProfile(
    groupId: string,
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await (supabase as any).rpc("join_group_from_profile", {
        p_group_id: groupId,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async updateGroupVisibility(
    groupId: string,
    patch: { is_discoverable?: boolean; show_on_profile?: boolean },
  ): Promise<{ error: Error | null }> {
    try {
      const { error } = await (supabase as any).rpc("update_group_visibility", {
        p_group_id: groupId,
        p_is_discoverable: patch.is_discoverable ?? null,
        p_show_on_profile: patch.show_on_profile ?? null,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  async listDiscoverableGroups(limit = 20, offset = 0): Promise<ProfileGroup[]> {
    try {
      const { data, error } = await (supabase as any).rpc("list_discoverable_groups", {
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      return (data ?? []) as ProfileGroup[];
    } catch (error) {
      console.error("Error listing discoverable groups:", error);
      return [];
    }
  },

  async getGroupsCreatedCount(userId: string): Promise<number> {
    try {
      const { data, error } = await (supabase as any).rpc("get_groups_administered");
      if (!error && Array.isArray(data)) {
        return data.length;
      }

      const { count, error: countError } = await (supabase as any)
        .from("groups")
        .select("*", { count: "exact", head: true })
        .eq("admin_id", userId);

      if (countError) throw countError;
      return count ?? 0;
    } catch {
      return 0;
    }
  },
};
