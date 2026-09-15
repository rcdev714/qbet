import type { BetaApprovalTokenResolution } from "./types";

export class BetaAccessAlreadySubmittedError extends Error {
  constructor() {
    super("ALREADY_SUBMITTED");
    this.name = "BetaAccessAlreadySubmittedError";
  }
}

export function isAlreadySubmittedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { message?: string; code?: string };
  return err.message?.includes("ALREADY_SUBMITTED") === true || err.code === "P0001";
}

export function parseApprovalTokenResponse(
  data: unknown,
): BetaApprovalTokenResolution | null {
  if (Array.isArray(data)) {
    return (data[0] as BetaApprovalTokenResolution | undefined) ?? null;
  }
  return (data as BetaApprovalTokenResolution | null) ?? null;
}

export function formatBetaAccessSubmitError(error: unknown): string {
  if (error instanceof BetaAccessAlreadySubmittedError) {
    return "ALREADY_SUBMITTED";
  }
  if (!error || typeof error !== "object") {
    return "Unknown error";
  }
  const err = error as { message?: string; details?: string; hint?: string; code?: string };
  const message = err.message ?? "Unknown error";

  if (message.includes("Could not find the function")) {
    return "Beta access is not configured yet. Run: npx supabase migration up --local";
  }
  if (message.includes("Country is not available")) {
    return "That country is not available for the current beta.";
  }
  if (message.includes("Invalid email")) {
    return "Please enter a valid email address.";
  }
  if (err.details) return err.details;
  return message;
}
