import { supabase } from "../lib/supabase";
import { createPostgresChannel } from "../lib/supabase-realtime";
import type { MarketChatMessage } from "../types/marketChat";

export const marketChatService = {
    /**
     * Fetch recent messages for a market
     */
    async getMessages(
        marketId: string,
        limit: number = 50,
    ): Promise<{ messages: MarketChatMessage[]; error: Error | null }> {
        try {
            const { data, error } = await supabase
                .from("market_chat_messages")
                .select(`
          *,
          user:users (
            id,
            username,
            email,
            avatar_url
          )
        `)
                .eq("market_id", marketId)
                .order("created_at", { ascending: false }) // Newest first for fetching
                .limit(limit);

            if (error) throw error;

            // Reverse to oldest first for display
            const messages = (data || [])
                .reverse() as unknown as MarketChatMessage[];
            return { messages, error: null };
        } catch (error) {
            console.error("Error fetching market messages:", error);
            return { messages: [], error: error as Error };
        }
    },

    /**
     * Send a message to a market chat
     */
    async sendMessage(
        marketId: string,
        content: string,
    ): Promise<{ message: MarketChatMessage | null; error: Error | null }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data, error } = await supabase
                .from("market_chat_messages")
                .insert({
                    market_id: marketId,
                    user_id: user.id,
                    content: content.trim(),
                })
                .select(`
          *,
          user:users (
            id,
            username,
            email,
            avatar_url
          )
        `)
                .single();

            if (error) throw error;

            return {
                message: data as unknown as MarketChatMessage,
                error: null,
            };
        } catch (error) {
            console.error("Error sending message:", error);
            return { message: null, error: error as Error };
        }
    },

    /**
     * Subscribe to new messages for a market
     */
    subscribeToMarket(
        marketId: string,
        callback: (message: MarketChatMessage) => void,
    ) {
        const channel = createPostgresChannel(`market_chat:${marketId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "market_chat_messages",
                    filter: `market_id=eq.${marketId}`,
                },
                async (payload) => {
                    // Fetch user details for the new message
                    const { data: userData } = await supabase
                        .from("users")
                        .select("id, username, email, avatar_url")
                        .eq("id", payload.new.user_id)
                        .single();

                    const newMessage = {
                        ...payload.new,
                        user: userData,
                    } as unknown as MarketChatMessage;

                    callback(newMessage);
                },
            )
            .subscribe();

        return channel;
    },
};
