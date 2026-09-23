/** Phone create/join flow for groups. Privacy maps onto the columns Expo already has. */

export const INVITE_CODE_LENGTH = 6;

export const CREATE_GROUP_STEPS = ["name", "photo", "privacy", "about"] as const;

export type CreateGroupStep = (typeof CREATE_GROUP_STEPS)[number];

/** Listed on the owner's profile, or hidden and reachable only with the code. */
export type GroupPrivacyChoice = "profile" | "invite";

export interface GroupCodePreview {
  groupId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
  isMember: boolean;
  isDiscoverable: boolean;
}

export type JoinCardState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "invalid" }
  | { kind: "lookup-failed" }
  | { kind: "preview-unavailable" }
  | { kind: "ready"; preview: GroupCodePreview }
  | { kind: "already-in"; preview: GroupCodePreview };

export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, INVITE_CODE_LENGTH);
}

export function isCompleteInviteCode(raw: string): boolean {
  return normalizeInviteCode(raw).length === INVITE_CODE_LENGTH;
}

export function privacyColumns(choice: GroupPrivacyChoice): {
  isDiscoverable: boolean;
  showOnProfile: boolean;
} {
  if (choice === "invite") {
    return { isDiscoverable: false, showOnProfile: false };
  }
  return { isDiscoverable: true, showOnProfile: true };
}

export function createStepIndex(step: CreateGroupStep): number {
  return CREATE_GROUP_STEPS.indexOf(step);
}

export function previousCreateStep(step: CreateGroupStep): CreateGroupStep | null {
  const index = createStepIndex(step);
  return index > 0 ? CREATE_GROUP_STEPS[index - 1] ?? null : null;
}

export function canContinueCreateStep(
  step: CreateGroupStep,
  draft: { name: string; privacy: GroupPrivacyChoice | null },
): boolean {
  if (step === "name") return draft.name.trim().length > 0;
  if (step === "privacy") return draft.privacy !== null;
  return true;
}

export function groupAvatarExtension(uri: string, mimeType?: string | null): string {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  const pathOnly = uri.split(/[?#]/)[0] ?? "";
  const dot = pathOnly.lastIndexOf(".");
  const raw = dot >= 0 ? pathOnly.slice(dot + 1).toLowerCase() : "";
  if (raw === "jpeg" || raw === "jpg") return "jpg";
  if (raw === "png" || raw === "webp" || raw === "gif") return raw;
  return "jpg";
}

export function parseGroupCodePreview(row: unknown): GroupCodePreview | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const groupId = typeof record.group_id === "string" ? record.group_id : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!groupId || !name) return null;

  const countRaw = record.member_count;
  const memberCount = typeof countRaw === "number" ? countRaw : Number(countRaw ?? 0);
  const description = typeof record.description === "string" ? record.description.trim() : "";

  return {
    groupId,
    name,
    description: description.length > 0 ? description : null,
    avatarUrl: typeof record.avatar_url === "string" && record.avatar_url.length > 0 ? record.avatar_url : null,
    memberCount: Number.isFinite(memberCount) ? Math.max(0, Math.floor(memberCount)) : 0,
    isMember: record.is_member === true,
    isDiscoverable: record.is_discoverable === true,
  };
}

export function classifyJoinError(message: string): "invalid" | "failed" {
  if (/group not found|invalid code|no rows|0 rows/i.test(message)) return "invalid";
  return "failed";
}

export function resolveJoinCard(input: {
  code: string;
  pending: boolean;
  missingRpc: boolean;
  errorMessage: string | null;
  preview: GroupCodePreview | null;
}): JoinCardState {
  if (!isCompleteInviteCode(input.code)) return { kind: "idle" };
  if (input.pending) return { kind: "pending" };
  if (input.missingRpc) return { kind: "preview-unavailable" };
  if (input.errorMessage) {
    return classifyJoinError(input.errorMessage) === "invalid"
      ? { kind: "invalid" }
      : { kind: "lookup-failed" };
  }
  if (!input.preview) return { kind: "invalid" };
  if (input.preview.isMember) return { kind: "already-in", preview: input.preview };
  return { kind: "ready", preview: input.preview };
}
