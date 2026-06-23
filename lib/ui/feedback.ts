import { Alert } from "react-native";

import { i18n } from "@/lib/i18n";
import { captureAppError } from "@/lib/sentry";

export function showAppAlert(
  titleKey: string,
  messageKey: string,
  namespace: "errors" | "common" = "errors",
): void {
  const title = i18n.t(`${namespace}:${titleKey}`, { defaultValue: titleKey });
  const message = i18n.t(`${namespace}:${messageKey}`, { defaultValue: messageKey });
  Alert.alert(title, message);
}

export function showAppAlertRaw(title: string, message: string): void {
  Alert.alert(title, message);
}

export { addAppBreadcrumb, captureAppError } from "@/lib/sentry";

export function captureUiError(
  error: unknown,
  screen: string,
  action?: string,
): void {
  captureAppError(error, { screen, action, source: "ui" });
}
