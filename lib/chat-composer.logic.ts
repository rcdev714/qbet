export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export function isEnterWithModifier(event: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}): boolean {
  if (event.key !== "Enter") return false;
  return Boolean(event.metaKey || event.ctrlKey);
}

export function resolveSendShortcutLabel(isApplePlatform: boolean): string {
  return isApplePlatform ? "⌘↵" : "Ctrl↵";
}
