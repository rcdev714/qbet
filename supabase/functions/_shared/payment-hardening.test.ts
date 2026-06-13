import {
  assert,
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildAllowedOrigins,
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
    "https://anymarket.expo.app",
    "https://app.example.com/wallet",
  ]);

  assertEquals(
    resolveAllowedUrl(
      "https://app.example.com/topup?success=true",
      "https://anymarket.expo.app/topup",
      origins,
    ),
    "https://app.example.com/topup?success=true",
  );
  assertEquals(
    resolveAllowedUrl(null, "https://anymarket.expo.app/topup", origins),
    "https://anymarket.expo.app/topup",
  );
});

Deno.test("resolveAllowedUrl rejects unconfigured origins", () => {
  const origins = buildAllowedOrigins(["https://anymarket.expo.app"]);

  assertThrows(() =>
    resolveAllowedUrl(
      "https://evil.example/topup",
      "https://anymarket.expo.app/topup",
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
