/** Normalize Expo Router search params (string | string[] | undefined) to a single string. */
export function getParamString(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}
