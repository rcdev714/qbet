import { Platform } from "react-native";

export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export function getSendShortcutLabel(): string {
  if (Platform.OS !== "web") return "";
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform)) {
    return "⌘↵";
  }
  return "Ctrl↵";
}

export function shouldSendChatMessage(event: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}): boolean {
  if (Platform.OS !== "web") return false;
  if (event.key !== "Enter") return false;
  return Boolean(event.metaKey || event.ctrlKey);
}
