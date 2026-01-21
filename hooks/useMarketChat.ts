import { useEffect, useRef, useState } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { marketChatService } from "../services/marketChat.service";
import type { MarketChatMessage } from "../types/marketChat";

export function useMarketChat(marketId: string) {
    const { user } = useAuthContext();
    const [messages, setMessages] = useState<MarketChatMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    // Ref to track if we're mounted and which market we're on
    const marketIdRef = useRef(marketId);

    // Refresh when market changes
    useEffect(() => {
        marketIdRef.current = marketId;
        loadMessages();

        // Subscribe to realtime updates
        const subscription = marketChatService.subscribeToMarket(
            marketId,
            (newMessage) => {
                setMessages((prev) => {
                    // Prevent duplicates
                    if (prev.some((m) => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
            },
        );

        return () => {
            subscription.unsubscribe();
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

        // creating optimistic message
        const tempId = `temp-${Date.now()}`;
        const optimisticMessage: MarketChatMessage = {
            id: tempId,
            market_id: marketId,
            user_id: user.id,
            content: content.trim(),
            created_at: new Date().toISOString(),
            user: {
                id: user.id,
                username: user.username || user.email?.split("@")[0] || "You",
                email: user.email || null,
                avatar_url: user.avatar_url || null,
            },
        };

        // Add optimistic message
        setMessages((prev) => [...prev, optimisticMessage]);
        setSending(true);

        const { message, error } = await marketChatService.sendMessage(
            marketId,
            content,
        );

        setSending(false);

        if (error) {
            // Remove optimistic message on error
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            return { error };
        }

        // Replace optimistic message with real one
        if (message) {
            setMessages((prev) =>
                prev.map((m) => m.id === tempId ? message : m)
            );
        }

        return { error: null };
    };

    return {
        messages,
        loading,
        sending,
        sendMessage,
        refresh: loadMessages,
    };
}
