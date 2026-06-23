export type BetaAccessRequestStatus = "pending" | "approved" | "declined";

export type BetaAccessRequest = {
  id: string;
  email: string;
  full_name: string | null;
  country_code: string;
  message: string | null;
  status: BetaAccessRequestStatus;
  user_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  approval_token?: string | null;
  approval_email_sent_at?: string | null;
};

export type BetaApprovalTokenResolution = {
  email: string;
  status: string;
  full_name: string | null;
  country_code: string;
  request_id: string;
};
