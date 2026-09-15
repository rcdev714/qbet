import type { AuthError } from "@supabase/supabase-js";

type AuthErrorLike = Pick<AuthError, "message" | "code" | "status">;

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function formatAuthError(
  error: unknown,
  messages: {
    invalidCredentials: string;
    userAlreadyExists: string;
    weakPassword: string;
    invalidEmail: string;
    generic: string;
  },
): string {
  if (!(error instanceof Error)) {
    return messages.generic;
  }

  const authError = error as unknown as AuthErrorLike;
  const code = authError.code ?? "";
  const message = authError.message ?? "";

  if (code === "invalid_credentials" || message.includes("Invalid login credentials")) {
    return messages.invalidCredentials;
  }

  if (code === "user_already_exists" || message.includes("already registered")) {
    return messages.userAlreadyExists;
  }

  if (code === "weak_password" || message.toLowerCase().includes("password")) {
    return messages.weakPassword;
  }

  if (code === "validation_failed" || message.toLowerCase().includes("invalid email")) {
    return messages.invalidEmail;
  }

  return message || messages.generic;
}
