import {
    assert,
    assertEquals,
    assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
    buildAllowedOrigins,
    computeCumulativeRefundDelta,
    getReferenceIdFromMetadata,
    getStripeObjectId,
    isOutboundPaymentFailureEvent,
    parsePositiveIntegerCents,
    resolveAllowedUrl,
} from "./payment-hardening.ts";

Deno.test("parsePositiveIntegerCents accepts integer cents", () => {
  assertEquals(parsePositiveIntegerCents(1250), 1250);
  assertEquals(parsePositiveIntegerCents("1250"), 1250);
});

Deno.test("parsePositiveIntegerCents rejects non-positive or fractional amounts", () => {
  assertThrows(() => parsePositiveIntegerCents(0));
  assertThrows(() => parsePositiveIntegerCents(-100));
  assertThrows(() => parsePositiveIntegerCents(12.34));
  assertThrows(() => parsePositiveIntegerCents("12.34"));
});

Deno.test("resolveAllowedUrl accepts configured origins and falls back safely", () => {
  const origins = buildAllowedOrigins([
    "https://anymarkt.com",
    "https://app.example.com/wallet",
  ]);

  assertEquals(
    resolveAllowedUrl(
      "https://app.example.com/topup?success=true",
      "https://anymarkt.com/topup",
      origins,
    ),
    "https://app.example.com/topup?success=true",
  );
  assertEquals(
    resolveAllowedUrl(null, "https://anymarkt.com/topup", origins),
    "https://anymarkt.com/topup",
  );
});

Deno.test("resolveAllowedUrl rejects unconfigured origins", () => {
  const origins = buildAllowedOrigins(["https://anymarkt.com"]);

  assertThrows(() =>
    resolveAllowedUrl(
      "https://evil.example/topup",
      "https://anymarkt.com/topup",
      origins,
    )
  );
});

Deno.test("isOutboundPaymentFailureEvent matches failure-like v2 events", () => {
  assert(
    isOutboundPaymentFailureEvent(
      "v2.money_management.outbound_payment.failed",
    ),
  );
  assert(
    isOutboundPaymentFailureEvent(
      "v2.money_management.outbound_payment.canceled",
    ),
  );
  assert(
    isOutboundPaymentFailureEvent(
      "v2.money_management.outbound_payment.returned",
    ),
  );
  assert(
    isOutboundPaymentFailureEvent(
      "v2.money_management.outbound_payment.reversed",
    ),
  );
});

Deno.test("isOutboundPaymentFailureEvent ignores successful or unrelated events", () => {
  assertEquals(
    isOutboundPaymentFailureEvent(
      "v2.money_management.outbound_payment.succeeded",
    ),
    false,
  );
  assertEquals(
    isOutboundPaymentFailureEvent("payment_intent.succeeded"),
    false,
  );
});

Deno.test("getReferenceIdFromMetadata prefers requestId metadata", () => {
  assertEquals(
    getReferenceIdFromMetadata({ requestId: "req_123" }, "fallback"),
    "req_123",
  );
  assertEquals(
    getReferenceIdFromMetadata({ request_id: "req_legacy" }, "fallback"),
    "req_legacy",
  );
  assertEquals(getReferenceIdFromMetadata({}, "fallback"), "fallback");
});

Deno.test("getStripeObjectId resolves string and object ids", () => {
  assertEquals(getStripeObjectId("pi_123"), "pi_123");
  assertEquals(getStripeObjectId({ id: "re_456" }), "re_456");
  assertEquals(getStripeObjectId(null), null);
});

Deno.test("computeCumulativeRefundDelta debits only incremental refund amount", () => {
  assertEquals(computeCumulativeRefundDelta(10, 0), 10);
  assertEquals(computeCumulativeRefundDelta(15, 10), 5);
  assertEquals(computeCumulativeRefundDelta(15, 15), 0);
  assertEquals(computeCumulativeRefundDelta(10, 12), 0);
});
