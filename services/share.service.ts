import { Platform, Share } from "react-native";
import { supabase } from "../lib/supabase";
import type { Market } from "../types/market";

const APP_URL = process.env.EXPO_PUBLIC_APP_URL || "https://anymarket.expo.app";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SHARE_REDIRECT_URL = `${SUPABASE_URL}/functions/v1/share-redirect`;

/**
 * Share service
 * Handles market sharing functionality with tracking
 */
export const shareService = {
    /**
     * Generate a shareable URL for a market
     */
    getShareUrl(marketId: string): string {
        // Use the redirector to generate dynamic OG tags for social previews
        return `${SHARE_REDIRECT_URL}?market=${marketId}`;
    },

    /**
     * Generate a shareable URL for a profile
     */
    getProfileShareUrl(userId: string): string {
        return `${APP_URL}/profile/${userId}`;
    },

    /**
     * Generate a shareable URL for a market with group context
     */
    getGroupShareUrl(marketId: string, groupId: string): string {
        // Use redirect for complex params to ensure OG tags and deep linking work correclty
        return `${SHARE_REDIRECT_URL}?market=${marketId}&group=${groupId}`;
    },

    /**
     * Track a share event in the database
     * Returns the unique share code
     */
    async trackShare(
        entityId: string,
        type: "market" | "profile",
        platform?: string,
    ): Promise<string | null> {
        try {
            // Only tracking market shares in DB for now per RPC
            if (type === "market") {
                const { data, error } = await supabase.rpc(
                    "track_market_share",
                    {
                        p_market_id: entityId,
                        p_platform: platform || Platform.OS,
                    },
                );

                if (error) throw error;
                return (data as unknown as string) || null;
            }
            return null;
        } catch (error) {
            console.error("Error tracking share:", error);
            return null;
        }
    },

    /**
     * Share a market using the native share sheet
     * Tracks the share event automatically
     */
    async shareMarket(
        market: Market,
    ): Promise<{ success: boolean; error: Error | null }> {
        try {
            const shareUrl = this.getShareUrl(market.id);

            // Track the share first (don't wait for it)
            this.trackShare(market.id, "market", Platform.OS).catch(
                console.error,
            );

            const message = `Predict this with me on AnyMarket:\n${market.question}`;
            const title = `Predict: ${market.question} | AnyMarket`;

            // Use native share
            const result = await Share.share(
                Platform.OS === "ios"
                    ? {
                        message,
                        url: shareUrl,
                    }
                    : {
                        // Android combines message and URL
                        message: `${message}\n\n${shareUrl}`,
                        title,
                    },
                {
                    dialogTitle: "Share this prediction",
                    subject: title,
                },
            );

            if (result.action === Share.sharedAction) {
                return { success: true, error: null };
            } else if (result.action === Share.dismissedAction) {
                // User dismissed the share sheet
                return { success: false, error: null };
            }

            return { success: true, error: null };
        } catch (error) {
            console.error("Error sharing market:", error);
            return { success: false, error: error as Error };
        }
    },

    /**
     * Share a profile using the native share sheet
     */
    async shareProfile(
        username: string,
        userId: string,
    ): Promise<{ success: boolean; error: Error | null }> {
        try {
            const shareUrl = this.getProfileShareUrl(userId);

            // Track the share (optional for profile)
            this.trackShare(userId, "profile", Platform.OS).catch(
                console.error,
            );

            const message = `See ${username}'s prediction track record on AnyMarket.`;
            const title = `${username} on AnyMarket`;

            const result = await Share.share(
                Platform.OS === "ios"
                    ? {
                        message,
                        url: shareUrl,
                    }
                    : {
                        message: `${message}\n\n${shareUrl}`,
                        title,
                    },
                {
                    dialogTitle: "Share this profile",
                    subject: title,
                },
            );

            if (result.action === Share.sharedAction) {
                return { success: true, error: null };
            }
            return { success: false, error: null };
        } catch (error) {
            console.error("Error sharing profile:", error);
            return { success: false, error: error as Error };
        }
    },

    /**
     * Copy share link to clipboard
     * Tracks the share event with 'copy' platform
     */
    async copyShareLink(
        id: string,
        type: "market" | "profile" = "market",
    ): Promise<{ url: string; success: boolean }> {
        try {
            const url = type === "market"
                ? this.getShareUrl(id)
                : this.getProfileShareUrl(id);

            // Track with 'copy' platform
            this.trackShare(id, type, "copy").catch(console.error);

            // Copy to clipboard using Clipboard API (works on web and RN)
            if (typeof navigator !== "undefined" && navigator.clipboard) {
                await navigator.clipboard.writeText(url);
            }

            return { url, success: true };
        } catch (error) {
            console.error("Error copying share link:", error);
            const url = type === "market"
                ? this.getShareUrl(id)
                : this.getProfileShareUrl(id);
            return { url, success: false };
        }
    },

    /**
     * Get share count for a market
     */
    async getShareCount(marketId: string): Promise<number> {
        try {
            const { count, error } = await supabase
                .from("market_shares")
                .select("*", { count: "exact", head: true })
                .eq("market_id", marketId);

            if (error) throw error;
            return count ?? 0;
        } catch (error) {
            console.error("Error getting share count:", error);
            return 0;
        }
    },
};
