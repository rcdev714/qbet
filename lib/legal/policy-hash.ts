import type { PolicyDocument } from "./policy-content";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}

/** Canonical payload used for policy_versions.content_hash (matches counsel evidence exports). */
export function canonicalPolicyPayload(doc: PolicyDocument): string {
  return stableStringify({
    kind: doc.kind,
    jurisdiction: doc.jurisdiction,
    version: doc.version,
    title: doc.title,
    route: doc.route,
    lastUpdated: doc.lastUpdated,
    seoDescription: doc.seoDescription,
    sections: doc.sections,
  });
}

export async function computePolicyContentHash(doc: PolicyDocument): Promise<string> {
  const payload = canonicalPolicyPayload(doc);
  if (typeof globalThis.crypto?.subtle?.digest === "function") {
    const bytes = new TextEncoder().encode(payload);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  const { createHash } = await import("crypto");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function computePolicyContentHashSync(doc: PolicyDocument): string {
  const payload = canonicalPolicyPayload(doc);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
