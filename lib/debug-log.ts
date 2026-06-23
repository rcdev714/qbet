type DebugLevel = "debug" | "info" | "warn" | "error";

type DebugPayload = Record<string, unknown>;

function isDebugEnabled(): boolean {
  if (typeof __DEV__ !== "undefined" && __DEV__) return true;
  return process.env.EXPO_PUBLIC_DEBUG_LOGS === "true";
}

function serializePayload(payload?: DebugPayload): string {
  if (!payload || Object.keys(payload).length === 0) return "";
  try {
    return ` ${JSON.stringify(payload)}`;
  } catch {
    return " [payload-unserializable]";
  }
}

export function createDebugLogger(namespace: string) {
  const prefix = `[${namespace}]`;

  function emit(level: DebugLevel, message: string, payload?: DebugPayload) {
    const line = `${prefix} ${message}${serializePayload(payload)}`;
    switch (level) {
      case "debug":
        if (isDebugEnabled()) console.debug(line);
        break;
      case "info":
        console.info(line);
        break;
      case "warn":
        console.warn(line);
        break;
      case "error":
        console.error(line);
        break;
    }
  }

  return {
    debug: (message: string, payload?: DebugPayload) => emit("debug", message, payload),
    info: (message: string, payload?: DebugPayload) => emit("info", message, payload),
    warn: (message: string, payload?: DebugPayload) => emit("warn", message, payload),
    error: (message: string, payload?: DebugPayload) => emit("error", message, payload),
    timed<T>(label: string, fn: () => Promise<T>, payload?: DebugPayload): Promise<T> {
      const started = Date.now();
      emit("debug", `${label} started`, payload);
      return fn()
        .then((result) => {
          emit("debug", `${label} completed`, {
            ...payload,
            durationMs: Date.now() - started,
          });
          return result;
        })
        .catch((error) => {
          emit("error", `${label} failed`, {
            ...payload,
            durationMs: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        });
    },
  };
}

export type DebugLogger = ReturnType<typeof createDebugLogger>;
