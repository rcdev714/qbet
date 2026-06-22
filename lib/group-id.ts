const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when groupId is a persisted UUID (not an optimistic temp-* placeholder). */
export function isPersistedGroupId(
  groupId: string | null | undefined,
): boolean {
  if (!groupId || groupId.startsWith("temp-")) return false;
  return UUID_REGEX.test(groupId);
}
