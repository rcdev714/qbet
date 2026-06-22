import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface UserProfile extends User {
    username?: string;
    avatar_url?: string;
    stats?: {
        total_bets: number;
        total_wins: number;
        win_rate: number;
        current_streak: number;
        best_streak: number;
    };
    is_following?: boolean;
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

            // The RPC returns { action: 'followed' | 'unfollowed' }
            const isFollowing = (data as any)?.action === "followed";
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
            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("id, username, avatar_url")
                .eq("id", targetUserId)
                .single();

            if (userError) throw userError;

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
                .select(`
                    created_at,
                    follower:users!follower_id (
                        id,
                        username,
                        avatar_url
                    )
                `)
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
};
