import { useCallback, useEffect, useRef, useState } from "react";
import { teardownChannel } from "../lib/supabase-realtime";
import { messageService } from "../services/message.service";
import type { Message, MessageInsert, MessageStatus } from "../types/message";

// Generate a unique temporary ID for optimistic messages
const generateTempId = () => `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export function useMessages(groupId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track pending messages to match them with real-time updates
  const pendingMessagesRef = useRef<Map<string, string>>(new Map()); // tempId -> content

  const fetchMessages = useCallback(async () => {
    if (!groupId) return;
    try {
      setLoading(true);
      const data = await messageService.getGroupMessages(groupId);
      // Mark all fetched messages as delivered (they're visible to everyone)
      const messagesWithStatus = data.map(msg => ({
        ...msg,
        status: 'delivered' as MessageStatus
      }));
      setMessages(messagesWithStatus);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    if (!groupId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    fetchMessages();
  }, [groupId, fetchMessages]);

  useEffect(() => {
    if (!groupId) return;

    const channel = messageService.subscribeToMessages(groupId, (newMessage) => {
      setMessages((prev) => {
        const existingIndex = prev.findIndex(
          (m) =>
            m.id === newMessage.id ||
            (m.id.startsWith("temp_") &&
              m.content === newMessage.content &&
              m.user_id === newMessage.user_id),
        );

        if (existingIndex !== -1) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...newMessage,
            status: "delivered" as MessageStatus,
          };
          return updated;
        }

        return [...prev, { ...newMessage, status: "delivered" as MessageStatus }];
      });
    });

    return () => {
      void teardownChannel(channel);
    };
  }, [groupId]);

  const sendMessage = async (data: Omit<MessageInsert, 'group_id'>) => {
    if (!groupId) return { message: null, error: new Error("No group selected") };

    // Generate a temporary ID for optimistic UI
    const tempId = generateTempId();
    const now = new Date().toISOString();

    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      group_id: groupId,
      user_id: data.user_id,
      content: data.content || null,
      message_type: data.message_type || 'text',
      market_id: data.market_id || null,
      created_at: now,
      status: 'sending', // Initially showing as sending (gray check)
    };

    // Add optimistic message immediately
    setMessages((prev) => [...prev, optimisticMessage]);

    // Track the pending message
    pendingMessagesRef.current.set(tempId, data.content || '');

    // Send to server
    const result = await messageService.sendMessage({
      ...data,
      group_id: groupId,
    });

    if (result.error) {
      // Remove the optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      pendingMessagesRef.current.delete(tempId);
      return result;
    }

    // Update optimistic message to 'sent' status
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId
          ? { ...m, id: result.message?.id || m.id, status: 'sent' as MessageStatus }
          : m
      )
    );

    // After a short delay, mark as delivered (simulating server broadcast)
    // In a real app, this would come from the realtime subscription
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === (result.message?.id || tempId)
            ? { ...m, status: 'delivered' as MessageStatus }
            : m
        )
      );
    }, 500);

    pendingMessagesRef.current.delete(tempId);
    return result;
  };

  // Update message status manually (can be used for read receipts)
  const updateMessageStatus = useCallback((messageId: string, status: MessageStatus) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status } : m))
    );
  }, []);

  // Add an optimistic message directly (used for market creation)
  const addOptimisticMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  // Update an optimistic message with real data (e.g., after market is created)
  const updateOptimisticMessage = useCallback((tempId: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, ...updates } : m))
    );
  }, []);

  // Remove an optimistic message (e.g., on error)
  const removeOptimisticMessage = useCallback((tempId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    refresh: fetchMessages,
    updateMessageStatus,
    addOptimisticMessage,
    updateOptimisticMessage,
    removeOptimisticMessage,
  };
}
