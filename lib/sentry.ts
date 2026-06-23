import * as Sentry from "@sentry/react-native";
import { isRunningInExpoGo } from "expo";

import { getPublicEnv } from "@/lib/public-env";

const PII_KEYS = ["email", "phone", "password", "token", "authorization", "stripeCustomerId"];

function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  if (event.user) {
    const { email: _e, username: _u, ...rest } = event.user;
    event.user = rest;
  }

  if (event.extra) {
    for (const key of PII_KEYS) {
      if (key in event.extra!) delete event.extra![key];
    }
  }

  return event;
}

let initialized = false;

export function initSentry(): void {
  if (initialized) return;

  const { sentryDsn, sentryEnabled, sentryDevEnabled } = getPublicEnv();
  const enabled =
    Boolean(sentryDsn) && (sentryDevEnabled || !__DEV__);

  Sentry.init({
    dsn: sentryDsn || undefined,
    enabled,
    environment: __DEV__ ? "development" : "production",
    sendDefaultPii: false,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    profilesSampleRate: __DEV__ ? 1.0 : 0.1,
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: __DEV__ ? 0 : 0.1,
    enableLogs: true,
    integrations: [
      Sentry.mobileReplayIntegration({
        maskAllText: true,
        maskAllImages: false,
      }),
      Sentry.feedbackIntegration(),
    ],
    enableNativeFramesTracking: !isRunningInExpoGo(),
    beforeSend: scrubEvent,
  });

  initialized = true;
}

export { Sentry };

export function captureAppError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext("app", context);
    }
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(String(error), "error");
    }
  });
}

export function addAppBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, string | number | boolean>,
): void {
  Sentry.addBreadcrumb({ category, message, data, level: "info" });
}

export function setSentryUser(userId: string | null): void {
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

export function setSentryTags(tags: Record<string, string>): void {
  for (const [key, value] of Object.entries(tags)) {
    Sentry.setTag(key, value);
  }
}
