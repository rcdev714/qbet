type EdgeLogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

type EdgeLogContext = Record<string, unknown>;

function newRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function createEdgeLogger(functionName: string, requestId = newRequestId()) {
  const prefix = `[${functionName}:${requestId}]`;

  function emit(level: EdgeLogLevel, message: string, context: EdgeLogContext = {}) {
    const payload = { requestId, ...context };
    const line = `${prefix} ${message}`;
    switch (level) {
      case "DEBUG":
        console.debug(line, JSON.stringify(payload));
        break;
      case "INFO":
        console.log(line, JSON.stringify(payload));
        break;
      case "WARN":
        console.warn(line, JSON.stringify(payload));
        break;
      case "ERROR":
        console.error(line, JSON.stringify(payload));
        void import("./sentry-bridge.ts").then(({ captureEdgeError }) =>
          captureEdgeError(new Error(message), { functionName, requestId, ...context }),
        ).catch(() => {});
        break;
    }
  }

  return {
    requestId,
    debug: (message: string, context?: EdgeLogContext) => emit("DEBUG", message, context),
    info: (message: string, context?: EdgeLogContext) => emit("INFO", message, context),
    warn: (message: string, context?: EdgeLogContext) => emit("WARN", message, context),
    error: (message: string, context?: EdgeLogContext) => emit("ERROR", message, context),
    timed<T>(label: string, fn: () => Promise<T>, context?: EdgeLogContext): Promise<T> {
      const started = Date.now();
      emit("DEBUG", `${label} started`, context);
      return fn()
        .then((result) => {
          emit("INFO", `${label} completed`, {
            ...context,
            durationMs: Date.now() - started,
          });
          return result;
        })
        .catch((error) => {
          emit("ERROR", `${label} failed`, {
            ...context,
            durationMs: Date.now() - started,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        });
    },
  };
}
