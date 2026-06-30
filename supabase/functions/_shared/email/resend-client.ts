export type ResendAttachment = {
  filename: string;
  content: string;
};

export type ResendSendParams = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  idempotencyKey: string;
  attachments?: ResendAttachment[];
  headers?: Record<string, string>;
};

export type ResendSendResult =
  | { ok: true; id: string }
  | { ok: false; status: number; message: string };

const MAX_RETRIES = 3;
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

export async function sendViaResend(
  apiKey: string,
  params: ResendSendParams,
): Promise<ResendSendResult> {
  let lastError = "Unknown error";

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": params.idempotencyKey,
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.attachments?.length ? { attachments: params.attachments } : {}),
        ...(params.headers ? { headers: params.headers } : {}),
      }),
    });

    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      return { ok: true, id: body.id ?? "unknown" };
    }

    lastError = body?.message ?? `HTTP ${response.status}`;

    if (!RETRYABLE.has(response.status) || attempt === MAX_RETRIES - 1) {
      return { ok: false, status: response.status, message: lastError };
    }

    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }

  return { ok: false, status: 500, message: lastError };
}
