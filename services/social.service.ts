import { User } from "@supabase/supabase-js";
import { USER_FOLLOWS_FOLLOWER_SELECT } from "../lib/supabase-embeds";
import { supabase } from "../lib/supabase";
import { isMissingRpcError } from "@/lib/social/feed-visibility";
import { mapDiscoverableUsers, mapSuggestedUsers, parseToggleFollowResponse, type DiscoverableUser } from "./social.parsers";

export interface UserProfile extends User {
    username?: string;
    avatar_url?: string;
    bio?: string | null;
    show_activity_on_feed?: boolean;
    stats?: {
        total_bets: number;
        total_wins: number;
        win_rate: number;
        current_streak: number;
        best_streak: number;
    };
    is_following?: boolean;
}

export type { DiscoverableUser } from "./social.parsers";

export interface FollowingActivity {
    activity_id: string;
    user_id: string;
    username: string;
    avatar_url: string;
    activity_type: string;
    market_id: string | null;
    market_question: string | null;
    market_status?: string | null;
    market_yes_pct?: number | null;
    side: string | null;
    bet_amount?: number | null;
    profit_loss?: number | null;
    group_id?: string | null;
    group_name?: string | null;
    comment_preview?: string | null;
    outcome?: string | null;
    is_member?: boolean;
    actor_total_bets?: number | null;
    actor_win_rate?: number | null;
    actor_current_streak?: number | null;
    created_at: string;
}

export interface MarketSocialProofBettor {
    user_id: string;
    username: string;
    avatar_url: string | null;
    side: string;
    amount: number;
}

export interface MarketSocialProof {
    followed_bettors: MarketSocialProofBettor[];
    total_followed: number;
}

export const socialService = {
    /**
     * Toggle follow status for a user
     */
    async toggleFollow(
        targetUserId: string,
    ): Promise<{ isFollowing: boolean; error: Error | null }> {
        try {
            const { data, error } = await supabase
                .rpc("toggle_user_follow", { p_target_user_id: targetUserId });

            if (error) throw error;

            const isFollowing = parseToggleFollowResponse(data);
            return { isFollowing, error: null };
        } catch (error) {
            console.error("Error toggling follow:", error);
            return { isFollowing: false, error: error as Error };
        }
    },

    /**
     * Check if current user follows target user
     */
    async getFollowStatus(
        currentUserId: string,
        targetUserId: string,
    ): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from("user_follows")
                .select("*")
                .eq("follower_id", currentUserId)
                .eq("following_id", targetUserId)
                .single();

            if (error && error.code !== "PGRST116") { // PGRST116 is "no rows returned"
                console.error("Error checking follow status:", error);
            }

            return !!data;
        } catch (error) {
            return false;
        }
    },

    /**
     * Get user profile with stats
     */
    async getProfile(
        targetUserId: string,
        currentUserId?: string,
    ): Promise<{ profile: UserProfile | null; error: Error | null }> {
        try {
            // 1. Get user details
            const withFlag = await (supabase as any)
                .from("users")
                .select("id, username, avatar_url, bio, show_activity_on_feed")
                .eq("id", targetUserId)
                .single();

            let userData = withFlag.data;
            if (withFlag.error) {
                if (!isMissingRpcError(withFlag.error) && !/show_activity_on_feed/i.test(withFlag.error.message ?? "")) {
                    throw withFlag.error;
                }
                const basic = await (supabase as any)
                    .from("users")
                    .select("id, username, avatar_url, bio")
                    .eq("id", targetUserId)
                    .single();
                if (basic.error) throw basic.error;
                userData = { ...basic.data, show_activity_on_feed: true };
            }

            // 2. Get stats
            const { data: statsData, error: statsError } = await supabase
                .from("user_stats")
                .select("*")
                .eq("user_id", targetUserId)
                .single();

            // Ignore stats error if just not found (new user)

            // 3. Get follow status if currentUserId provided
            let isFollowing = false;
            if (currentUserId && currentUserId !== targetUserId) {
                isFollowing = await this.getFollowStatus(
                    currentUserId,
                    targetUserId,
                );
            }

            const profile: UserProfile = {
                ...userData,
                // Add dummy User properties to satisfy interface if needed, or just partial
                app_metadata: {},
                user_metadata: {},
                aud: "authenticated",
                created_at: "",
                stats: statsData || {
                    total_bets: 0,
                    total_wins: 0,
                    win_rate: 0,
                    current_streak: 0,
                    best_streak: 0,
                },
                is_following: isFollowing,
            } as unknown as UserProfile;

            return { profile, error: null };
        } catch (error) {
            console.error("Error fetching profile:", error);
            return { profile: null, error: error as Error };
        }
    },

    /**
     * Search users by username
     */
    async searchUsers(query: string): Promise<UserProfile[]> {
        try {
            if (!query || query.length < 2) return [];

            const { data, error } = await supabase
                .from("users")
                .select("id, username, avatar_url")
                .ilike("username", `%${query}%`)
                .limit(10);

            if (error) throw error;

            return (data || []) as unknown as UserProfile[];
        } catch (error) {
            console.error("Error searching users:", error);
            return [];
        }
    },

    /**
     * Get follower and following counts for a user
     */
    async getFollowStats(
        userId: string,
    ): Promise<{ followers: number; following: number }> {
        try {
            const { data, error } = await supabase
                .rpc("get_follow_counts", { p_user_id: userId });

            if (error) throw error;

            if (data && data.length > 0) {
                return {
                    followers: data[0].followers_count,
                    following: data[0].following_count,
                };
            }

            return { followers: 0, following: 0 };
        } catch (error) {
            console.error("Error getting follow stats:", error);
            return { followers: 0, following: 0 };
        }
    },

    /**
     * Get list of followers for a user
     */
    async getFollowers(
        userId: string,
    ): Promise<
        {
            id: string;
            username: string;
            avatar_url: string;
            created_at: string;
        }[]
    > {
        try {
            const { data, error } = await supabase
                .from("user_follows")
                .select(USER_FOLLOWS_FOLLOWER_SELECT)
                .eq("following_id", userId)
                .order("created_at", { ascending: false });

            if (error) throw error;

            return data.map((item: any) => ({
                id: item.follower.id,
                username: item.follower.username,
                avatar_url: item.follower.avatar_url,
                created_at: item.created_at,
            }));
        } catch (error) {
            console.error("Error getting followers:", error);
            return [];
        }
    },

    async getFollowing(
        userId: string,
    ): Promise<
        {
            id: string;
            username: string;
            avatar_url: string;
            followed_at: string;
        }[]
    > {
        try {
            const { data, error } = await (supabase as any).rpc("get_following", {
                p_user_id: userId,
            });

            if (error) throw error;

            return ((data ?? []) as any[]).map((row: any) => ({
                id: row.id,
                username: row.username,
                avatar_url: row.avatar_url,
                followed_at: row.followed_at,
            }));
        } catch (error) {
            console.error("Error getting following:", error);
            return [];
        }
    },

    async getFollowingActivity(limit = 30, offset = 0): Promise<FollowingActivity[]> {
        try {
            const { data, error } = await (supabase as any).rpc("get_following_activity_v2", {
                p_limit: limit,
                p_offset: offset,
            });
            if (error) {
                const { data: fallback, error: fallbackError } = await (supabase as any).rpc(
                    "get_following_activity",
                    { p_limit: limit },
                );
                if (fallbackError) throw fallbackError;
                return (fallback ?? []) as FollowingActivity[];
            }
            return (data ?? []) as FollowingActivity[];
        } catch (error) {
            console.error("Error getting following activity:", error);
            return [];
        }
    },

    async listDiscoverableUsers(limit = 30, offset = 0): Promise<DiscoverableUser[]> {
        try {
            const { data, error } = await (supabase as any).rpc("list_discoverable_users", {
                p_limit: limit,
                p_offset: offset,
            });
            if (error) throw error;
            return mapDiscoverableUsers((data ?? []) as Record<string, unknown>[]);
        } catch (error) {
            console.error("Error listing discoverable users:", error);
            return [];
        }
    },

    async getSuggestedUsers(limit = 10): Promise<DiscoverableUser[]> {
        try {
            const { data, error } = await (supabase as any).rpc("get_suggested_users", {
                p_limit: limit,
            });
            if (error) throw error;
            return mapSuggestedUsers((data ?? []) as Record<string, unknown>[]);
        } catch (error) {
            console.error("Error getting suggested users:", error);
            return [];
        }
    },

    async getMarketSocialProof(marketId: string): Promise<MarketSocialProof> {
        try {
            const { data, error } = await (supabase as any).rpc("get_market_social_proof", {
                p_market_id: marketId,
            });
            if (error) throw error;
            const parsed = (data ?? {}) as Record<string, unknown>;
            return {
                followed_bettors: ((parsed.followed_bettors as MarketSocialProofBettor[]) ?? []).map((row) => ({
                    user_id: String(row.user_id),
                    username: String(row.username),
                    avatar_url: (row.avatar_url as string | null) ?? null,
                    side: String(row.side),
                    amount: Number(row.amount ?? 0),
                })),
                total_followed: Number(parsed.total_followed ?? 0),
            };
        } catch (error) {
            console.error("Error getting market social proof:", error);
            return { followed_bettors: [], total_followed: 0 };
        }
    },

    async getSocialFeed(
        mode: "discover" | "following",
        limit = 30,
        offset = 0,
    ): Promise<{ items: FollowingActivity[]; error: Error | null }> {
        try {
            const { data, error } = await (supabase as any).rpc("get_social_feed", {
                p_mode: mode,
                p_limit: limit,
                p_offset: offset,
            });
            if (error) {
                if (isMissingRpcError(error) && mode === "following") {
                    const items = await this.getFollowingActivity(limit, offset);
                    return { items, error: null };
                }
                if (isMissingRpcError(error)) return { items: [], error: null };
                throw error;
            }
            return { items: (data ?? []) as FollowingActivity[], error: null };
        } catch (error) {
            console.error("Error getting social feed:", error);
            return { items: [], error: error as Error };
        }
    },

    async getProfileActivity(
        userId: string,
        limit = 20,
        offset = 0,
    ): Promise<{ items: FollowingActivity[]; error: Error | null }> {
        try {
            const { data, error } = await (supabase as any).rpc("get_profile_activity", {
                p_user_id: userId,
                p_limit: limit,
                p_offset: offset,
            });
            if (error) {
                if (isMissingRpcError(error)) return { items: [], error: null };
                throw error;
            }
            return { items: (data ?? []) as FollowingActivity[], error: null };
        } catch (error) {
            console.error("Error getting profile activity:", error);
            return { items: [], error: error as Error };
        }
    },

    async isProfileActivityVisible(userId: string): Promise<boolean> {
        try {
            const { data: authData } = await supabase.auth.getUser();
            if (authData.user?.id === userId) return true;
            const { data, error } = await (supabase as any).rpc("profile_activity_is_visible", {
                p_user_id: userId,
            });
            if (error) return isMissingRpcError(error);
            return Boolean(data);
        } catch {
            return true;
        }
    },

    async getShowActivityOnFeed(): Promise<boolean> {
        try {
            const { data: authData } = await supabase.auth.getUser();
            if (!authData.user) return true;
            const { data, error } = await (supabase as any)
                .from("users")
                .select("show_activity_on_feed")
                .eq("id", authData.user.id)
                .maybeSingle();
            if (error || !data || data.show_activity_on_feed == null) return true;
            return Boolean(data.show_activity_on_feed);
        } catch {
            return true;
        }
    },

    async setShowActivityOnFeed(
        enabled: boolean,
    ): Promise<{ enabled: boolean; error: Error | null }> {
        try {
            const { data, error } = await (supabase as any).rpc("set_show_activity_on_feed", {
                p_enabled: enabled,
            });
            if (error) throw error;
            return { enabled: Boolean(data), error: null };
        } catch (error) {
            console.error("Error updating activity sharing:", error);
            return { enabled, error: error as Error };
        }
    },

    async findOrCreateDmGroup(otherUserId: string): Promise<{ groupId: string | null; error: Error | null }> {
        try {
            const { data, error } = await (supabase as any).rpc("find_or_create_dm_group", {
                p_other_user_id: otherUserId,
            });
            if (error) throw error;
            return { groupId: data as string, error: null };
        } catch (error) {
            return { groupId: null, error: error as Error };
        }
    },
};
