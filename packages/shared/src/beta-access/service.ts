import { getSupabase } from "../supabase";
import {
  BetaAccessAlreadySubmittedError,
  isAlreadySubmittedError,
  parseApprovalTokenResponse,
} from "./parsers";
import type {
  BetaAccessRequest,
  BetaAccessRequestStatus,
  BetaApprovalTokenResolution,
} from "./types";

export {
  BetaAccessAlreadySubmittedError,
  formatBetaAccessSubmitError,
  parseApprovalTokenResponse,
} from "./parsers";
export type {
  BetaAccessRequest,
  BetaAccessRequestStatus,
  BetaApprovalTokenResolution,
} from "./types";

export const betaAccessService = {
  async submitRequest(input: {
    email: string;
    fullName: string;
    countryCode: string;
    message?: string | null;
  }): Promise<string> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("submit_beta_access_request" as never, {
      p_email: input.email.trim(),
      p_full_name: input.fullName.trim(),
      p_country_code: input.countryCode,
      p_message: input.message?.trim() ?? null,
    } as never);
    if (error) {
      if (isAlreadySubmittedError(error)) {
        throw new BetaAccessAlreadySubmittedError();
      }
      throw error;
    }
    return data as string;
  },

  async listRequests(status: BetaAccessRequestStatus): Promise<BetaAccessRequest[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("list_beta_access_requests" as never, {
      p_status: status,
    } as never);
    if (error) throw error;
    return (data ?? []) as BetaAccessRequest[];
  },

  async approveRequest(id: string, adminNotes?: string | null): Promise<BetaAccessRequest> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("approve_beta_access_request" as never, {
      p_request_id: id,
      p_admin_notes: adminNotes ?? null,
    } as never);
    if (error) throw error;
    return data as BetaAccessRequest;
  },

  async declineRequest(id: string, adminNotes?: string | null): Promise<BetaAccessRequest> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("decline_beta_access_request" as never, {
      p_request_id: id,
      p_admin_notes: adminNotes ?? null,
    } as never);
    if (error) throw error;
    return data as BetaAccessRequest;
  },

  async getRequestByEmail(email: string): Promise<BetaAccessRequest | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("get_beta_access_request_by_email" as never, {
      p_email: email.trim(),
    } as never);
    if (error) throw error;
    return (data as BetaAccessRequest | null) ?? null;
  },

  async resolveApprovalToken(token: string): Promise<BetaApprovalTokenResolution | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("resolve_beta_approval_token" as never, {
      p_token: token.trim(),
    } as never);
    if (error) throw error;
    return parseApprovalTokenResponse(data);
  },

  async sendApprovalEmail(
    requestId: string,
    forceResend = false,
  ): Promise<{ skipped?: boolean; sentAt?: string }> {
    const supabase = getSupabase();
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
