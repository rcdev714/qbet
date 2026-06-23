import { Platform } from "react-native";

import {
    CHAT_MESSAGE_MAX_LENGTH,
    isEnterWithModifier,
    resolveSendShortcutLabel,
} from "./chat-composer.logic";

export { CHAT_MESSAGE_MAX_LENGTH, isEnterWithModifier, resolveSendShortcutLabel };

export function getSendShortcutLabel(): string {
  if (Platform.OS !== "web") return "";
  const isApplePlatform =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);
  return resolveSendShortcutLabel(isApplePlatform);
}

export function shouldSendChatMessage(event: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}): boolean {
  if (Platform.OS !== "web") return false;
  return isEnterWithModifier(event);
}
