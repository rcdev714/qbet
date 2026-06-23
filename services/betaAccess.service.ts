import { supabase } from "@/lib/supabase";
import {
    BetaAccessAlreadySubmittedError,
    isAlreadySubmittedError,
    parseApprovalTokenResponse
} from "./betaAccess.parsers";
import type {
    BetaAccessRequest,
    BetaAccessRequestStatus,
    BetaApprovalTokenResolution,
} from "./betaAccess.types";

export {
    BetaAccessAlreadySubmittedError,
    formatBetaAccessSubmitError,
    parseApprovalTokenResponse
} from "./betaAccess.parsers";
export type {
    BetaAccessRequest,
    BetaAccessRequestStatus,
    BetaApprovalTokenResolution
} from "./betaAccess.types";

export const betaAccessService = {
  async submitRequest(input: {
    email: string;
    fullName: string;
    countryCode: string;
    message?: string | null;
  }): Promise<string> {
    const { data, error } = await (supabase as any).rpc("submit_beta_access_request", {
      p_email: input.email.trim(),
      p_full_name: input.fullName.trim(),
      p_country_code: input.countryCode,
      p_message: input.message?.trim() ?? null,
    });
    if (error) {
      if (isAlreadySubmittedError(error)) {
        throw new BetaAccessAlreadySubmittedError();
      }
      throw error;
    }
    return data as string;
  },

  async listRequests(status: BetaAccessRequestStatus): Promise<BetaAccessRequest[]> {
    const { data, error } = await (supabase as any).rpc("list_beta_access_requests", {
      p_status: status,
    });
    if (error) throw error;
    return (data ?? []) as BetaAccessRequest[];
  },

  async approveRequest(id: string, adminNotes?: string | null): Promise<BetaAccessRequest> {
    const { data, error } = await (supabase as any).rpc("approve_beta_access_request", {
      p_request_id: id,
      p_admin_notes: adminNotes ?? null,
    });
    if (error) throw error;
    return data as BetaAccessRequest;
  },

  async declineRequest(id: string, adminNotes?: string | null): Promise<BetaAccessRequest> {
    const { data, error } = await (supabase as any).rpc("decline_beta_access_request", {
      p_request_id: id,
      p_admin_notes: adminNotes ?? null,
    });
    if (error) throw error;
    return data as BetaAccessRequest;
  },

  async getRequestByEmail(email: string): Promise<BetaAccessRequest | null> {
    const { data, error } = await (supabase as any).rpc("get_beta_access_request_by_email", {
      p_email: email.trim(),
    });
    if (error) throw error;
    return (data as BetaAccessRequest | null) ?? null;
  },

  async resolveApprovalToken(token: string): Promise<BetaApprovalTokenResolution | null> {
    const { data, error } = await (supabase as any).rpc("resolve_beta_approval_token", {
      p_token: token.trim(),
    });
    if (error) throw error;
    return parseApprovalTokenResponse(data);
  },

  async sendApprovalEmail(requestId: string, forceResend = false): Promise<{ skipped?: boolean; sentAt?: string }> {
    const { data, error } = await supabase.functions.invoke("send-beta-approval-email", {
      body: { requestId, forceResend },
    });
    if (error) throw error;
    if (data && typeof data === "object" && "error" in data && data.error) {
      throw new Error(String(data.error));
    }
    return (data ?? {}) as { skipped?: boolean; sentAt?: string };
  },
};
