import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export function useMarketLikes(marketId: string) {
    const { user } = useAuthContext();
    const [liked, setLiked] = useState(false);
    const [count, setCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // Fetch initial state
    useEffect(() => {
        let mounted = true;

        async function fetchLikes() {
            try {
                // Get count
                const { count: likeCount, error: countError } = await supabase
                    .from("market_likes")
                    .select("*", { count: "exact", head: true })
                    .eq("market_id", marketId);

                if (countError) throw countError;

                // Check if user liked (only if logged in)
                let isLiked = false;
                if (user) {
                    const { data, error: likeError } = await supabase
                        .from("market_likes")
                        .select("id")
                        .eq("market_id", marketId)
                        .eq("user_id", user.id)
                        .maybeSingle();

                    if (!likeError && data) {
                        isLiked = true;
                    }
                }

                if (mounted) {
                    setCount(likeCount || 0);
                    setLiked(isLiked);
                }
            } catch (e) {
                console.error("Error fetching likes:", e);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        fetchLikes();

        return () => {
            mounted = false;
        };
    }, [marketId, user]);

    // Toggle like
    const toggleLike = useCallback(async () => {
        if (!user) return; // Optional: Trigger auth modal here

        // Haptics
        Haptics.selectionAsync();

        // Optimistic Update
        const previousLiked = liked;
        const previousCount = count;

        setLiked(!previousLiked);
        setCount(previousLiked ? previousCount - 1 : previousCount + 1);

        try {
            // Call RPC
            const { data, error } = await supabase.rpc("toggle_market_like", {
                p_market_id: marketId,
            });

            if (error) throw error;

            // Sync with server response if needed, but usually RPC returns new state
            // Sync with server response if needed, but usually RPC returns new state
            if (data) {
                // data is { liked: boolean, count: number }
                const result = data as { liked: boolean; count: number };
                setLiked(result.liked);
                setCount(result.count);
            }
        } catch (e) {
            console.error("Error toggling like:", e);
            // Revert on error
            setLiked(previousLiked);
            setCount(previousCount);
            alert("Failed to update like");
        }
    }, [marketId, user, liked, count]);

    return { liked, count, loading, toggleLike };
}
