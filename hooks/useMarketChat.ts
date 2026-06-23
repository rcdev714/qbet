import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { teardownChannel } from "../lib/supabase-realtime";
import { marketChatService } from "../services/marketChat.service";
import { mentionService } from "../services/mention.service";
import type { MarketChatMessage } from "../types/marketChat";
import type { MentionEmbedPayload } from "../types/mention";

export function useMarketChat(marketId: string) {
    const { user } = useAuthContext();
    const [messages, setMessages] = useState<MarketChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const marketIdRef = useRef(marketId);

    useEffect(() => {
        marketIdRef.current = marketId;
        loadMessages();

        const subscription = marketChatService.subscribeToMarket(
            marketId,
            (newMessage) => {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
            },
        );

        return () => {
            void teardownChannel(subscription);
        };
    }, [marketId]);

    const loadMessages = async () => {
        setLoading(true);
        const { messages: data } = await marketChatService.getMessages(
            marketId,
        );
        if (marketIdRef.current === marketId) {
            setMessages(data);
            setLoading(false);
        }
    };

    const sendMessage = async (content: string) => {
        if (!content.trim() || !user) return;

        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: MarketChatMessage = {
            id: tempId,
            market_id: marketId,
            user_id: user.id,
            content: content.trim(),
            message_type: "text",
            created_at: new Date().toISOString(),
            user: {
                id: user.id,
                username: user.username || user.email?.split("@")[0] || "You",
                email: user.email || null,
                avatar_url: user.avatar_url || null,
            },
        };

        setMessages((prev) => [...prev, optimisticMessage]);
        setSending(true);

        const { message, error } = await marketChatService.sendMessage(
            marketId,
            content,
        );

        setSending(false);

        if (error) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            return { error };
        }

        if (message) {
            setMessages((prev) =>
                prev.map((m) => m.id === tempId ? message : m)
            );
        }

        return { error: null };
    };

    const sendMentionMessage = async (payload: MentionEmbedPayload) => {
        if (!user) return { error: new Error("Not authenticated") };

        const tempId = `temp-mention-${Date.now()}`;
        const optimisticMessage: MarketChatMessage = {
            id: tempId,
            market_id: marketId,
            user_id: user.id,
            content: payload.type === "group" ? "Shared a group" : payload.type === "profile" ? "Shared a profile" : "Shared a bet",
            message_type: payload.type === "group" ? "shared_group" : payload.type === "profile" ? "shared_profile" : "shared_bet",
            referenced_group_id: payload.type === "group" ? payload.groupId : null,
            referenced_user_id: payload.type === "profile" ? payload.userId : null,
            bet_id: payload.type === "bet" ? payload.betId : null,
            created_at: new Date().toISOString(),
            user: {
                id: user.id,
                username: user.username || user.email?.split("@")[0] || "You",
                email: user.email || null,
                avatar_url: user.avatar_url || null,
            },
        };

        setMessages((prev) => [...prev, optimisticMessage]);
        setSending(true);

        const { message, error } = await mentionService.sendMarketMentionMessage(
            marketId,
            user.id,
            payload,
        );

        setSending(false);

        if (error) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            return { error };
        }

        if (message) {
            setMessages((prev) => prev.map((m) => (m.id === tempId ? message : m)));
        }

        return { error: null };
    };

    return {
        messages,
        loading,
        sending,
        sendMessage,
        sendMentionMessage,
        refresh: loadMessages,
    };
}
