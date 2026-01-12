import { supabase } from "../lib/supabase";
import type { Message, MessageInsert, MessageType } from "../types/message";
import { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Message service
 * Handles chat message operations and real-time subscriptions
 */
export const messageService = {
  /**
   * Send a new message
   */
  async sendMessage(data: MessageInsert): Promise<{ message: Message | null; error: Error | null }> {
    try {
      const { data: message, error } = await supabase
        .from("messages")
        .insert({
          group_id: data.group_id,
          user_id: data.user_id,
          content: data.content,
          message_type: data.message_type || "text",
          market_id: data.market_id,
        })
        .select(`
          *,
          user:users(*),
          market:markets(*)
        `)
        .single();

      if (error || !message) {
        return { message: null, error: error || new Error("Failed to send message") };
      }

      return { message: message as unknown as Message, error: null };
    } catch (error) {
      return { message: null, error: error as Error };
    }
  },

  /**
   * Get messages for a group
   */
  async getGroupMessages(groupId: string, limit: number = 50): Promise<Message[]> {
    try {
      console.log("[messageService] Fetching messages for group:", groupId);
      const { data: messages, error } = await supabase
        .from("messages")
        .select(`
          *,
          user:users(*),
          market:markets(*)
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        console.error("[messageService] Error fetching messages:", error);
        return [];
      }

      console.log("[messageService] Fetched messages count:", messages?.length || 0);
      return (messages || []).reverse() as unknown as Message[];
    } catch (error) {
      console.error("[messageService] Error fetching messages:", error);
      return [];
    }
  },

  /**
   * Get the last message for a group
   */
  async getLastMessage(groupId: string): Promise<Message | null> {
    try {
      const { data: messages, error } = await supabase
        .from("messages")
        .select(`
          *,
          user:users(*),
          market:markets(*)
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error || !messages || messages.length === 0) {
        return null;
      }

      return messages[0] as unknown as Message;
    } catch (error) {
      return null;
    }
  },

  /**
   * Get unread message count for a group (messages from last 24 hours)
   * In a production app, you'd track last_read_at timestamp per user per group
   */
  async getUnreadCount(groupId: string, userId: string): Promise<number> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { count, error } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("group_id", groupId)
        .neq("user_id", userId) // Don't count own messages
        .gte("created_at", oneDayAgo.toISOString());

      if (error) {
        return 0;
      }

      return count || 0;
    } catch (error) {
      return 0;
    }
  },

  /**
   * Subscribe to real-time messages for a group
   */
  subscribeToMessages(
    groupId: string,
    onMessage: (message: Message) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel(`group-messages:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          console.log("[messageService] Real-time INSERT received:", payload.new.id);
          // Fetch full message with user and market data
          const { data: message, error } = await supabase
            .from("messages")
            .select(`
              *,
              user:users(*),
              market:markets(*)
            `)
            .eq("id", payload.new.id)
            .single();

          if (message && !error) {
            console.log("[messageService] Real-time message fetched:", message.id);
            onMessage(message as unknown as Message);
          } else {
            console.error("[messageService] Failed to fetch real-time message:", error);
          }
        }
      )
      .subscribe();

    return channel;
  },
};

