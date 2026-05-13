import { supabase } from "../lib/supabase";

/**
 * Resolution service
 * Handles resolution proofs and disputes for market transparency
 */

export interface ResolutionProof {
    id: string;
    market_id: string;
    resolver_id: string;
    winning_option_id: string;
    evidence_url: string | null;
    evidence_notes: string | null;
    resolved_at: string;
}

export interface Dispute {
    id: string;
    market_id: string;
    challenger_id: string;
    reason: string;
    evidence_url: string | null;
    status: "pending" | "upheld" | "overturned" | "dismissed";
    admin_response: string | null;
    resolved_by: string | null;
    created_at: string;
    resolved_at: string | null;
}

export const resolutionService = {
    /**
     * Get the resolution proof for a market
     */
    async getResolutionProof(
        marketId: string,
    ): Promise<ResolutionProof | null> {
        try {
            const { data, error } = await supabase
                .rpc("get_resolution_proof", { p_market_id: marketId });

            if (error) {
                console.error("Error fetching resolution proof:", error);
                return null;
            }

            return (data as unknown) as ResolutionProof;
        } catch (error) {
            console.error("Error fetching resolution proof:", error);
            return null;
        }
    },

    /**
     * Submit a dispute for a resolved market
     */
    async submitDispute(
        marketId: string,
        reason: string,
        evidenceUrl?: string,
    ): Promise<{ dispute: Dispute | null; error: Error | null }> {
        try {
            const { data, error } = await supabase
                .rpc("submit_dispute", {
                    p_market_id: marketId,
                    p_reason: reason,
                    p_evidence_url: evidenceUrl || undefined,
                });

            if (error) {
                return { dispute: null, error };
            }

            return { dispute: (data as unknown) as Dispute, error: null };
        } catch (error) {
            return { dispute: null, error: error as Error };
        }
    },

    /**
     * Get all disputes for a market
     */
    async getDisputesByMarket(marketId: string): Promise<Dispute[]> {
        try {
            const { data, error } = await supabase
                .from("disputes")
                .select("*")
                .eq("market_id", marketId)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error fetching disputes:", error);
                return [];
            }

            return (data || []) as unknown as Dispute[];
        } catch (error) {
            console.error("Error fetching disputes:", error);
            return [];
        }
    },

    /**
     * Get pending disputes (admin view)
     */
    async getPendingDisputes(): Promise<Dispute[]> {
        try {
            const { data, error } = await supabase
                .from("disputes")
                .select("*")
                .eq("status", "pending")
                .order("created_at", { ascending: true });

            if (error) {
                console.error("Error fetching pending disputes:", error);
                return [];
            }

            return (data || []) as unknown as Dispute[];
        } catch (error) {
            console.error("Error fetching pending disputes:", error);
            return [];
        }
    },

    /**
     * Resolve a dispute (admin only)
     */
    async resolveDispute(
        disputeId: string,
        status: "upheld" | "overturned" | "dismissed",
        adminResponse?: string,
    ): Promise<{ dispute: Dispute | null; error: Error | null }> {
        try {
            const { data, error } = await supabase
                .rpc("resolve_dispute", {
                    p_dispute_id: disputeId,
                    p_status: status,
                    p_admin_response: adminResponse || undefined,
                });

            if (error) {
                return { dispute: null, error };
            }

            return { dispute: (data as unknown) as Dispute, error: null };
        } catch (error) {
            return { dispute: null, error: error as Error };
        }
    },
};
