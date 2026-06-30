export type UnsubscribeCategory = "social" | "market_results" | "group_invites" | "all";

export async function createUnsubscribeToken(params: {
  userId: string;
  category: UnsubscribeCategory;
  appUrl: string;
  secret: string;
}): Promise<{ token: string; hash: string; url: string }> {
  const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
  const payload = `${params.userId}:${params.category}:${expiresAt}`;
  const hash = await hmacSha256Hex(params.secret, payload);
  const token = btoa(`${payload}:${hash}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const url = `${params.appUrl.replace(/\/$/, "")}/email/unsubscribe?token=${encodeURIComponent(token)}`;
  return { token, hash, url };
}

export async function verifyUnsubscribeToken(
  token: string,
  secret: string,
): Promise<{ userId: string; category: UnsubscribeCategory; hash: string } | null> {
  try {
    const normalized = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(padded);
    const parts = decoded.split(":");
    if (parts.length < 4) return null;
    const hash = parts.pop()!;
    const expiresAt = Number(parts.pop());
    const category = parts.pop() as UnsubscribeCategory;
    const userId = parts.join(":");
    if (!userId || !category || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      return null;
    }
    const payload = `${userId}:${category}:${expiresAt}`;
    const expected = await hmacSha256Hex(secret, payload);
    if (expected !== hash) return null;
    return { userId, category, hash };
  } catch {
    return null;
  }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function buildListUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
