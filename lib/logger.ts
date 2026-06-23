import { getPublicEnv } from "@/lib/public-env";
import { captureAppError } from "@/lib/sentry";

type LogContext = Record<string, unknown>;

function shouldLogDebug(): boolean {
  return __DEV__ || getPublicEnv().debugLogs;
}

function formatMessage(message: string, context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) return message;
  try {
    return `${message} ${JSON.stringify(context)}`;
  } catch {
    return message;
  }
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (!shouldLogDebug()) return;
    console.debug(formatMessage(message, context));
  },

  info(message: string, context?: LogContext): void {
    if (__DEV__) {
      console.log(formatMessage(message, context));
    }
    // Sentry.logger when available in production builds with enableLogs
    try {
      const { Sentry } = require("@/lib/sentry");
      Sentry.logger?.info?.(message, context);
    } catch {
      // SDK not initialized
    }
  },

  warn(message: string, context?: LogContext): void {
    console.warn(formatMessage(message, context));
    try {
      const { Sentry } = require("@/lib/sentry");
      Sentry.logger?.warn?.(message, context);
    } catch {
      // SDK not initialized
    }
  },

  error(message: string, context?: LogContext, error?: unknown): void {
    console.error(formatMessage(message, context), error);
    if (error) {
      captureAppError(error, { message, ...context });
    } else {
      captureAppError(new Error(message), context);
    }
  },
};
