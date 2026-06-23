import { supabase } from "@/lib/supabase";

export type ContentReportTargetType =
  | "market_chat_message"
  | "group_message"
  | "user_profile";

export type ContentReport = {
  id: string;
  reporter_id: string;
  target_type: ContentReportTargetType;
  target_id: string;
  target_user_id: string | null;
  reason: string;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  admin_notes: string | null;
  created_at: string;
};

export const moderationService = {
  async reportContent(input: {
    targetType: ContentReportTargetType;
    targetId: string;
    targetUserId?: string | null;
    reason: string;
    details?: string | null;
  }): Promise<string> {
    const { data, error } = await (supabase as any).rpc("report_content", {
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_target_user_id: input.targetUserId ?? null,
      p_reason: input.reason,
      p_details: input.details ?? null,
    });
    if (error) throw error;
    return data as string;
  },

  async blockUser(blockedId: string): Promise<void> {
    const { error } = await (supabase as any).rpc("block_user", {
      p_blocked_id: blockedId,
    });
    if (error) throw error;
  },

  async unblockUser(blockedId: string): Promise<void> {
    const { error } = await (supabase as any).rpc("unblock_user", {
      p_blocked_id: blockedId,
    });
    if (error) throw error;
  },

  async isUserBlocked(targetUserId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return false;
    const { data, error } = await (supabase as any).rpc("is_user_blocked", {
      p_viewer_id: user.id,
      p_target_id: targetUserId,
    });
    if (error) return false;
    return data === true;
  },

  async listContentReports(status: string = "open"): Promise<ContentReport[]> {
    const { data, error } = await (supabase as any).rpc("list_content_reports", {
      p_status: status,
    });
    if (error) throw error;
    return (data || []) as ContentReport[];
  },

  async resolveContentReport(input: {
    reportId: string;
    status: "resolved" | "dismissed" | "reviewing";
    adminNotes?: string;
    restrictUser?: boolean;
  }): Promise<void> {
    const { error } = await (supabase as any).rpc("resolve_content_report", {
      p_report_id: input.reportId,
      p_status: input.status,
      p_admin_notes: input.adminNotes ?? null,
      p_restrict_user: input.restrictUser ?? false,
    });
    if (error) throw error;
  },
};
