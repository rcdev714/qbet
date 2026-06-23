export function formatActionError(error: unknown): string {
  if (!error || typeof error !== "object") return "Unknown error";
  const err = error as { message?: string; details?: string; context?: { body?: string } };
  if (err.message?.includes("Could not find the function")) {
    return "Beta access migrations are missing. Run: npx supabase migration up --local";
  }
  if (err.context?.body) {
    try {
      const body = JSON.parse(err.context.body) as { error?: string; message?: string };
      if (body.error) return body.error;
      if (body.message) return body.message;
    } catch {
      /* ignore */
    }
  }
  return err.details ?? err.message ?? "Unknown error";
}
