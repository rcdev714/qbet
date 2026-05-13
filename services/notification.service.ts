import { supabase } from "../lib/supabase";

/**
 * Notification service
 * Handles user notifications for market events, follows, etc.
 */

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    title: string;
    body: string | null;
    data: Record<string, any> | null;
    read_at: string | null;
    created_at: string;
}

export const notificationService = {
    /**
     * Get user's notifications
     */
    async getNotifications(
        limit = 50,
        unreadOnly = false,
    ): Promise<Notification[]> {
        try {
            const { data, error } = await supabase
                .rpc("get_notifications", {
                    p_limit: limit,
                    p_unread_only: unreadOnly,
                });

            if (error) {
                console.error("Error fetching notifications:", error);
                return [];
            }

            return (data || []) as Notification[];
        } catch (error) {
            console.error("Error fetching notifications:", error);
            return [];
        }
    },

    /**
     * Get count of unread notifications
     */
    async getUnreadCount(): Promise<number> {
        try {
            const { data, error } = await supabase
                .rpc("get_unread_notification_count");

            if (error) {
                console.error("Error getting unread count:", error);
                return 0;
            }

            return Number(data) || 0;
        } catch (error) {
            console.error("Error getting unread count:", error);
            return 0;
        }
    },

    /**
     * Mark a single notification as read
     */
    async markAsRead(
        notificationId: string,
    ): Promise<{ success: boolean; error: Error | null }> {
        try {
            const { error } = await supabase
                .rpc("mark_notification_read", {
                    p_notification_id: notificationId,
                });

            if (error) {
                return { success: false, error };
            }

            return { success: true, error: null };
        } catch (error) {
            return { success: false, error: error as Error };
        }
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(): Promise<{ count: number; error: Error | null }> {
        try {
            const { data, error } = await supabase
                .rpc("mark_all_notifications_read");

            if (error) {
                return { count: 0, error };
            }

            return { count: Number(data) || 0, error: null };
        } catch (error) {
            return { count: 0, error: error as Error };
        }
    },

    /**
     * Subscribe to new notifications (real-time)
     */
    subscribeToNotifications(
        userId: string,
        callback: (notification: Notification) => void,
    ) {
        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications",
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    callback(payload.new as Notification);
                },
            )
            .subscribe();

        return channel;
    },
};
