import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  recipientBankCapabilities,
} from "./stripe-global-payouts.ts";

Deno.test("recipientBankCapabilities requests wire for Ecuador", () => {
  assertEquals(recipientBankCapabilities("ec"), { wire: { requested: true } });
  assertEquals(recipientBankCapabilities("EC"), { wire: { requested: true } });
});

Deno.test("recipientBankCapabilities requests local for non-EC countries", () => {
  assertEquals(recipientBankCapabilities("us"), { local: { requested: true } });
  assertEquals(recipientBankCapabilities("mx"), { local: { requested: true } });
});
