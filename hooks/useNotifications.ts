import { useCallback, useEffect, useState } from "react";

import { useAuthContext } from "@/contexts/AuthContext";
import {
    Notification,
    notificationService,
} from "@/services/notification.service";
import { notificationDispatchService } from "@/services/notificationDispatch.service";

export function useNotifications() {
  const { user } = useAuthContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [items, count] = await Promise.all([
        notificationService.getNotifications(50),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(items);
      setUnreadCount(count);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const markAsRead = useCallback(async (id: string) => {
    const { success } = await notificationService.markAsRead(id);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const { error } = await notificationService.markAllAsRead();
    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      );
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = notificationService.subscribeToNotifications(user.id, (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((c) => c + 1);
      notificationDispatchService.dispatchNotification(notification.id);
    });

    return () => {
      void notificationService.unsubscribeFromNotifications(channel);
    };
  }, [user?.id]);

  return {
    notifications,
    unreadCount,
    loading,
    refresh,
    markAsRead,
    markAllAsRead,
  };
}
