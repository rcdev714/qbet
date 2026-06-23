import {
    diagnoseMissingBetContract,
    formatDiagnosisForDebug,
    type BetContractDiagnosis,
} from "@/lib/bet-contract-diagnostics";
import { createDebugLogger } from "@/lib/debug-log";
import type { BetContractEventType, BetContractRecord } from "@/lib/legal/bet-contract";
import { supabase } from "@/lib/supabase";

const log = createDebugLogger("betContractService");

const CONTRACT_FETCH_RETRIES = 3;
const CONTRACT_FETCH_DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type BetContractEmailResult = {
  ok: boolean;
  skipped?: boolean;
  sentAt?: string;
  emailId?: string;
  error?: string;
  debug?: Record<string, unknown>;
};

export type BetContractLoadResult = {
  contract: BetContractRecord | null;
  diagnosis: BetContractDiagnosis | null;
  attempts: number;
  durationMs: number;
};

export type BetContractPipelineResult = {
  status: "sent" | "skipped" | "missing" | "failed";
  contractId?: string;
  betId: string;
  error?: string;
  debug?: Record<string, unknown>;
};

async function fetchContractOnce(betId: string): Promise<BetContractRecord | null> {
  const { data, error } = await (supabase as any).rpc("get_bet_contract_by_bet_id", {
    p_bet_id: betId,
  });

  if (error) {
    log.error("getByBetId RPC failed", {
      betId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  return (data as BetContractRecord | null) ?? null;
}

export const betContractService = {
  async getByBetId(betId: string): Promise<BetContractRecord | null> {
    const result = await this.loadWithDiagnostics(betId);
    return result.contract;
  },

  async loadWithDiagnostics(betId: string): Promise<BetContractLoadResult> {
    const started = Date.now();
    let contract: BetContractRecord | null = null;
    let attempts = 0;

    log.debug("loadWithDiagnostics started", { betId });

    for (let attempt = 1; attempt <= CONTRACT_FETCH_RETRIES; attempt += 1) {
      attempts = attempt;
      contract = await fetchContractOnce(betId);
      if (contract) {
        log.info("contract loaded", {
          betId,
          contractId: contract.id,
          contractNumber: contract.contract_number,
          attempt,
        });
        break;
      }
      if (attempt < CONTRACT_FETCH_RETRIES) {
        log.debug("contract not ready, retrying", { betId, attempt, delayMs: CONTRACT_FETCH_DELAY_MS });
        await sleep(CONTRACT_FETCH_DELAY_MS);
      }
    }

    if (contract) {
      return {
        contract,
        diagnosis: null,
        attempts,
        durationMs: Date.now() - started,
      };
    }

    const diagnosis = await diagnoseMissingBetContract(betId);
    log.warn("contract missing after retries", {
      betId,
      attempts,
      reason: diagnosis.reason,
      details: diagnosis.details,
    });

    return {
      contract: null,
      diagnosis,
      attempts,
      durationMs: Date.now() - started,
    };
  },

  async sendEmail(
    contractId: string,
    eventType: BetContractEventType,
    forceResend = false,
  ): Promise<BetContractEmailResult> {
    const started = Date.now();
    log.info("sendEmail started", { contractId, eventType, forceResend });

    const { data, error } = await supabase.functions.invoke("send-bet-contract-email", {
      body: { contractId, eventType, forceResend },
    });

    const debug = {
      contractId,
      eventType,
      forceResend,
      durationMs: Date.now() - started,
      response: data ?? null,
    };

    if (error) {
      log.error("sendEmail invoke failed", {
        ...debug,
        message: error.message,
        context: (error as { context?: unknown }).context,
      });
      return { ok: false, error: error.message, debug };
    }

    if (data && typeof data === "object" && "error" in data && data.error) {
      const message = String(data.error);
      log.error("sendEmail function returned error", { ...debug, message });
      return { ok: false, error: message, debug };
    }

    const payload = (data ?? {}) as { skipped?: boolean; sentAt?: string; emailId?: string };
    log.info("sendEmail completed", {
      ...debug,
      skipped: Boolean(payload.skipped),
      sentAt: payload.sentAt,
      emailId: payload.emailId,
    });

    return {
      ok: true,
      skipped: Boolean(payload.skipped),
      sentAt: payload.sentAt,
      emailId: payload.emailId,
      debug,
    };
  },

  async runPlacedPipeline(betId: string): Promise<BetContractPipelineResult> {
    return log.timed(
      "placed pipeline",
      async () => {
        const load = await this.loadWithDiagnostics(betId);
        if (!load.contract?.id) {
          return {
            status: "missing" as const,
            betId,
            error: load.diagnosis?.message,
            debug: {
              reason: load.diagnosis?.reason,
              attempts: load.attempts,
              durationMs: load.durationMs,
            },
          };
        }

        const email = await this.sendEmail(load.contract.id, "placed");
        if (!email.ok) {
          return {
            status: "failed" as const,
            betId,
            contractId: load.contract.id,
            error: email.error,
            debug: email.debug,
          };
        }

        return {
          status: email.skipped ? ("skipped" as const) : ("sent" as const),
          betId,
          contractId: load.contract.id,
          debug: email.debug,
        };
      },
      { betId },
    );
  },

  formatDiagnosisForDebug,
};
