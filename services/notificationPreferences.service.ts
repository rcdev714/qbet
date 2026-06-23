import { supabase } from "../lib/supabase";

export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  push_web_enabled: boolean;
  in_app_enabled: boolean;
  email_market_results: boolean;
  email_social: boolean;
  email_group_invites: boolean;
  push_market_results: boolean;
  push_social: boolean;
  in_app_market_results: boolean;
  in_app_social: boolean;
  updated_at: string;
}

export type NotificationPreferencesUpdate = Partial<
  Omit<NotificationPreferences, "user_id" | "updated_at">
>;

export const notificationPreferencesService = {
  async getPreferences(): Promise<{
    preferences: NotificationPreferences | null;
    error: Error | null;
  }> {
    try {
      const { data, error } = await (supabase as any).rpc("get_notification_preferences");
      if (error) throw error;
      return { preferences: data as NotificationPreferences, error: null };
    } catch (error) {
      console.error("Error fetching notification preferences:", error);
      return { preferences: null, error: error as Error };
    }
  },

  async updatePreferences(
    prefs: NotificationPreferencesUpdate,
  ): Promise<{ preferences: NotificationPreferences | null; error: Error | null }> {
    try {
      const { data, error } = await (supabase as any).rpc("update_notification_preferences", {
        p_prefs: prefs,
      });
      if (error) throw error;
      return { preferences: data as NotificationPreferences, error: null };
    } catch (error) {
      console.error("Error updating notification preferences:", error);
      return { preferences: null, error: error as Error };
    }
  },

  async registerWebPushSubscription(subscription: PushSubscription): Promise<{ error: Error | null }> {
    try {
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Invalid push subscription");
      }

      const { error } = await (supabase as any).rpc("register_web_push_subscription", {
        p_endpoint: json.endpoint,
        p_p256dh: json.keys.p256dh,
        p_auth: json.keys.auth,
        p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error("Error registering web push:", error);
      return { error: error as Error };
    }
  },

  async unregisterWebPushSubscription(endpoint: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await (supabase as any)
        .from("web_push_subscriptions")
        .delete()
        .eq("endpoint", endpoint);
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};
