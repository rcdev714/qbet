import { supabase } from "../lib/supabase";

/**
 * Invokes the dispatch-notification edge function (service role via anon + user session
 * is not used — called from authenticated admin/cron paths or after signup).
 * For production, configure a Database Webhook on notification_dispatch_queue INSERT.
 */
export const notificationDispatchService = {
  async dispatchNotification(notificationId: string): Promise<void> {
    try {
      await supabase.functions.invoke("dispatch-notification", {
        body: { notificationId },
      });
    } catch (error) {
      console.warn("dispatch-notification invoke failed:", error);
    }
  },

  async processQueue(): Promise<void> {
    try {
      await supabase.functions.invoke("dispatch-notification", {
        body: { processQueue: true },
      });
    } catch (error) {
      console.warn("dispatch-notification queue processing failed:", error);
    }
  },
};
