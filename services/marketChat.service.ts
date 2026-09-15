import { MARKET_CHAT_MESSAGE_SELECT } from "../lib/supabase-embeds";
import { supabase } from "../lib/supabase";
import { createPostgresChannel } from "../lib/supabase-realtime";
import type { MarketChatMessage, MarketChatMessageInsert } from "../types/marketChat";

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
                .select(MARKET_CHAT_MESSAGE_SELECT)
                .eq("market_id", marketId)
                .order("created_at", { ascending: false })
                .limit(limit);

            if (error) throw error;

            const messages = (data || [])
                .reverse() as unknown as MarketChatMessage[];
            return { messages, error: null };
        } catch (error) {
            console.error("Error fetching market messages:", error);
            return { messages: [], error: error as Error };
        }
    },

    /**
     * Send a text message to a market chat
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
                    message_type: "text",
                })
                .select(MARKET_CHAT_MESSAGE_SELECT)
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

    async sendMentionMessage(
        data: MarketChatMessageInsert,
    ): Promise<{ message: MarketChatMessage | null; error: Error | null }> {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data: message, error } = await supabase
                .from("market_chat_messages")
                .insert({
                    market_id: data.market_id,
                    user_id: data.user_id,
                    content: data.content ?? "",
                    message_type: data.message_type ?? "text",
                    referenced_group_id: data.referenced_group_id,
                    referenced_user_id: data.referenced_user_id,
                    bet_id: data.bet_id,
                })
                .select(MARKET_CHAT_MESSAGE_SELECT)
                .single();

            if (error) throw error;

            return {
                message: message as unknown as MarketChatMessage,
                error: null,
            };
        } catch (error) {
            console.error("Error sending mention message:", error);
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
