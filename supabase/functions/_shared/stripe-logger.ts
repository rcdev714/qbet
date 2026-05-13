/**
 * Stripe Logger - Centralized logging for Stripe payment operations
 *
 * Provides structured, consistent logging across all Stripe edge functions
 * with severity levels and transaction tracking.
 */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogContext {
  userId?: string;
  requestId?: string;
  paymentIntentId?: string;
  transferId?: string;
  accountId?: string;
  customerId?: string;
  eventId?: string;
  eventType?: string;
  livemode?: boolean;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  function: string;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class StripeLogger {
  private static instance: StripeLogger;
  private functionName: string = "unknown";

  private constructor() {}

  static getInstance(): StripeLogger {
    if (!StripeLogger.instance) {
      StripeLogger.instance = new StripeLogger();
    }
    return StripeLogger.instance;
  }

  /**
   * Set the current function context for all subsequent logs
   */
  setFunction(name: string): StripeLogger {
    this.functionName = name;
    return this;
  }

  /**
   * Create a child logger with pre-set context
   */
  withContext(context: LogContext): ContextualLogger {
    return new ContextualLogger(this, context);
  }

  private formatEntry(
    level: LogLevel,
    message: string,
    context: LogContext,
    error?: Error,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      function: this.functionName,
      message,
      context: {
        ...context,
        // Mask sensitive data
        ...(context.customerId &&
          { customerId: this.maskId(context.customerId) }),
      },
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };
  }

  private maskId(id: string): string {
    if (id.length <= 8) return id;
    return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`;
  }

  private log(
    level: LogLevel,
    message: string,
    context: LogContext = {},
    error?: Error,
  ): void {
    const entry = this.formatEntry(level, message, context, error);
    const prefix = `[${this.functionName}]`;
    const modeTag = context.livemode === true
      ? "🟢 LIVE"
      : context.livemode === false
      ? "🟡 TEST"
      : "";

    const logMessage = `${prefix}${modeTag ? ` ${modeTag}` : ""} ${message}`;

    switch (level) {
      case "DEBUG":
        console.debug(logMessage, JSON.stringify(entry.context));
        break;
      case "INFO":
        console.log(logMessage, JSON.stringify(entry.context));
        break;
      case "WARN":
        console.warn(logMessage, JSON.stringify(entry.context));
        break;
      case "ERROR":
        console.error(
          logMessage,
          entry.error
            ? JSON.stringify({ ...entry.context, error: entry.error })
            : JSON.stringify(entry.context),
        );
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log("DEBUG", message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log("INFO", message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log("WARN", message, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log("ERROR", message, context, error);
  }

  /**
   * Log a Stripe event receipt
   */
  logEvent(
    eventType: string,
    eventId: string,
    livemode: boolean,
    additionalContext?: LogContext,
  ): void {
    this.info(`📩 Received Stripe event: ${eventType}`, {
      eventType,
      eventId,
      livemode,
      ...additionalContext,
    });
  }

  /**
   * Log a payment operation start
   */
  logPaymentStart(operation: string, context: LogContext): void {
    this.info(`💳 Starting: ${operation}`, context);
  }

  /**
   * Log a payment operation success
   */
  logPaymentSuccess(operation: string, context: LogContext): void {
    this.info(`✅ Success: ${operation}`, context);
  }

  /**
   * Log a payment operation failure
   */
  logPaymentFailure(
    operation: string,
    error: Error,
    context: LogContext,
  ): void {
    this.error(`❌ Failed: ${operation}`, error, context);
  }

  /**
   * Log a wallet balance change
   */
  logBalanceChange(
    type: "credit" | "debit",
    amount: number,
    userId: string,
    context?: LogContext,
  ): void {
    const emoji = type === "credit" ? "💰" : "💸";
    this.info(`${emoji} Wallet ${type}: $${amount.toFixed(2)}`, {
      userId,
      amount,
      balanceChangeType: type,
      ...context,
    });
  }
}

/**
 * Contextual logger with pre-set context values
 */
class ContextualLogger {
  constructor(
    private parent: StripeLogger,
    private context: LogContext,
  ) {}

  debug(message: string, additionalContext?: LogContext): void {
    this.parent.debug(message, { ...this.context, ...additionalContext });
  }

  info(message: string, additionalContext?: LogContext): void {
    this.parent.info(message, { ...this.context, ...additionalContext });
  }

  warn(message: string, additionalContext?: LogContext): void {
    this.parent.warn(message, { ...this.context, ...additionalContext });
  }

  error(message: string, error?: Error, additionalContext?: LogContext): void {
    this.parent.error(message, error, {
      ...this.context,
      ...additionalContext,
    });
  }
}

// Export singleton instance
export const stripeLogger = StripeLogger.getInstance();
