import { supabase } from "../lib/supabase";

/**
 * Like service
 * Handles market likes/favorites functionality
 */
export const likeService = {
    /**
     * Toggle like status for a market
     * Returns the new like state and count
     */
    async toggleLike(marketId: string): Promise<{ liked: boolean; count: number; error: Error | null }> {
        try {
            const { data, error } = await supabase.rpc("toggle_market_like", {
                p_market_id: marketId,
            });

            if (error) throw error;

            const result = data as { liked: boolean; count: number } | null;
            return {
                liked: result?.liked ?? false,
                count: result?.count ?? 0,
                error: null,
            };
        } catch (error) {
            console.error("Error toggling like:", error);
            return {
                liked: false,
                count: 0,
                error: error as Error,
            };
        }
    },

    /**
     * Check if the current user has liked a market
     */
    async hasLiked(marketId: string): Promise<boolean> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const { data, error } = await supabase
                .from("market_likes")
                .select("id")
                .eq("user_id", user.id)
                .eq("market_id", marketId)
                .maybeSingle();

            if (error) throw error;
            return !!data;
        } catch (error) {
            console.error("Error checking like status:", error);
            return false;
        }
    },

    /**
     * Get like count for a market
     */
    async getLikeCount(marketId: string): Promise<number> {
        try {
            const { count, error } = await supabase
                .from("market_likes")
                .select("*", { count: "exact", head: true })
                .eq("market_id", marketId);

            if (error) throw error;
            return count ?? 0;
        } catch (error) {
            console.error("Error getting like count:", error);
            return 0;
        }
    },

    /**
     * Get social stats for a market (like count, share count, comment count)
     */
    async getSocialStats(marketId: string): Promise<{
        likeCount: number;
        shareCount: number;
        commentCount: number;
    }> {
        try {
            const { data, error } = await supabase.rpc("get_market_social_stats", {
                p_market_id: marketId,
            });

            if (error) throw error;

            // RPC returns an array with one row
            const row = Array.isArray(data) ? data[0] : data;
            
            return {
                likeCount: Number(row?.like_count ?? 0),
                shareCount: Number(row?.share_count ?? 0),
                commentCount: Number(row?.comment_count ?? 0),
            };
        } catch (error) {
            console.error("Error getting social stats:", error);
            return {
                likeCount: 0,
                shareCount: 0,
                commentCount: 0,
            };
        }
    },

    /**
     * Get markets liked by the current user
     */
    async getLikedMarkets(): Promise<string[]> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];

            const { data, error } = await supabase
                .from("market_likes")
                .select("market_id")
                .eq("user_id", user.id);

            if (error) throw error;
            return (data?.map(row => row.market_id) ?? []) as string[];
        } catch (error) {
            console.error("Error getting liked markets:", error);
            return [];
        }
    },

    /**
     * Batch check if user has liked multiple markets
     * Returns a map of market_id -> liked status
     */
    async hasLikedBatch(marketIds: string[]): Promise<Record<string, boolean>> {
        try {
            if (marketIds.length === 0) return {};

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return marketIds.reduce((acc, id) => ({ ...acc, [id]: false }), {});
            }

            const { data, error } = await supabase
                .from("market_likes")
                .select("market_id")
                .eq("user_id", user.id)
                .in("market_id", marketIds);

            if (error) throw error;

            const likedSet = new Set((data?.map(row => row.market_id) ?? []) as string[]);
            return marketIds.reduce((acc, id) => ({
                ...acc,
                [id]: likedSet.has(id),
            }), {});
        } catch (error) {
            console.error("Error batch checking likes:", error);
            return marketIds.reduce((acc, id) => ({ ...acc, [id]: false }), {});
        }
    },
};
