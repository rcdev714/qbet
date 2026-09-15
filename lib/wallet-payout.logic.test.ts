import assert from "node:assert/strict";
import test from "node:test";

import { ECUADOR_BANKS, findEcuadorBank } from "../constants/ecuador-banks";
import {
  buildConnectVerificationBody,
  buildPayoutSteps,
  derivePayoutSetupState,
  mapOnboardingLabelKey,
  parseBankDetailsDraft,
  sanitizePayoutDraft,
  shouldShowPayoutSidePanel,
  shouldUseDesktopWalletLayout,
  validateEcuadorCedula,
} from "./wallet-payout.logic";

test("validateEcuadorCedula accepts 10 digits", () => {
  assert.equal(validateEcuadorCedula("1712345678"), true);
  assert.equal(validateEcuadorCedula("171-234-5678"), true);
});

test("validateEcuadorCedula rejects invalid lengths", () => {
  assert.equal(validateEcuadorCedula("123"), false);
  assert.equal(validateEcuadorCedula("12345678901"), false);
  assert.equal(validateEcuadorCedula(""), false);
});

test("sanitizePayoutDraft keeps allowed keys only", () => {
  assert.deepEqual(
    sanitizePayoutDraft({
      bank_name: "Banco Pichincha",
      swift: "PICHECEQ",
      account_number: "should-be-stripped",
      id_number: "should-be-stripped",
    }),
    {
      bank_name: "Banco Pichincha",
      swift: "PICHECEQ",
    },
  );
});

test("parseBankDetailsDraft maps snake_case wallet json", () => {
  assert.deepEqual(
    parseBankDetailsDraft({
      bank_code: "pichincha",
      bank_name: "Banco Pichincha",
      swift: "PICHECEQ",
      city: "Quito",
      province: "Pichincha",
      first_name: "Ana",
      last_name: "Lopez",
    }),
    {
      bankCode: "pichincha",
      bankName: "Banco Pichincha",
      swift: "PICHECEQ",
      city: "Quito",
      province: "Pichincha",
      firstName: "Ana",
      lastName: "Lopez",
      addressLine1: undefined,
      postalCode: undefined,
    },
  );
});

test("derivePayoutSetupState returns ready when connect and global payouts complete", () => {
  assert.equal(
    derivePayoutSetupState({
      connect: { detailsSubmitted: true, payoutsEnabled: true },
      globalPayouts: { hasRecipient: true, hasPayoutMethod: true },
      hasProfileDraft: true,
    }),
    "ready",
  );
});

test("derivePayoutSetupState returns needs_profile for verified user without draft", () => {
  assert.equal(
    derivePayoutSetupState({
      connect: { detailsSubmitted: false, payoutsEnabled: false },
      globalPayouts: { hasRecipient: false, hasPayoutMethod: false },
      hasProfileDraft: false,
    }),
    "needs_profile",
  );
});

test("derivePayoutSetupState returns needs_bank when draft exists without connect review block", () => {
  assert.equal(
    derivePayoutSetupState({
      connect: { detailsSubmitted: false, payoutsEnabled: false },
      globalPayouts: { hasRecipient: true, hasPayoutMethod: false },
      hasProfileDraft: true,
    }),
    "needs_bank",
  );
});

test("derivePayoutSetupState prioritizes pending_review over needs_bank when connect is under review", () => {
  assert.equal(
    derivePayoutSetupState({
      connect: { detailsSubmitted: true, payoutsEnabled: false },
      globalPayouts: { hasRecipient: true, hasPayoutMethod: false },
      hasProfileDraft: true,
    }),
    "pending_review",
  );
});

test("derivePayoutSetupState returns pending_review when connect submitted but payouts disabled", () => {
  assert.equal(
    derivePayoutSetupState({
      connect: { detailsSubmitted: true, payoutsEnabled: false },
      globalPayouts: { hasRecipient: false, hasPayoutMethod: false },
      hasProfileDraft: false,
    }),
    "pending_review",
  );
});

test("buildPayoutSteps marks identity done when live wallet ready", () => {
  assert.deepEqual(
    buildPayoutSteps({
      liveWalletReady: true,
      onboardingState: "needs_profile",
      profileSubmitted: false,
      bankLinked: false,
    }),
    {
      identity: "done",
      profile: "current",
      bank: "pending",
    },
  );
});

test("buildPayoutSteps marks bank current after profile submitted", () => {
  assert.deepEqual(
    buildPayoutSteps({
      liveWalletReady: true,
      onboardingState: "needs_bank",
      profileSubmitted: true,
      bankLinked: false,
    }),
    {
      identity: "done",
      profile: "done",
      bank: "current",
    },
  );
});

test("buildConnectVerificationBody maps EC cédula fields", () => {
  assert.deepEqual(
    buildConnectVerificationBody({
      firstName: "Ana",
      lastName: "Lopez",
      dobDay: 1,
      dobMonth: 2,
      dobYear: 1990,
      addressLine1: "Av. Amazonas",
      city: "Quito",
      state: "Pichincha",
      postalCode: "170135",
      country: "EC",
      idNumber: "1712345678",
    }),
    {
      firstName: "Ana",
      lastName: "Lopez",
      dobDay: 1,
      dobMonth: 2,
      dobYear: 1990,
      addressLine1: "Av. Amazonas",
      city: "Quito",
      state: "Pichincha",
      postalCode: "170135",
      country: "EC",
      idNumber: "1712345678",
      idType: "cedula",
    },
  );
});

test("buildConnectVerificationBody maps US SSN last 4", () => {
  const body = buildConnectVerificationBody({
    firstName: "Sam",
    lastName: "Rivera",
    dobDay: 10,
    dobMonth: 11,
    dobYear: 1985,
    addressLine1: "1 Main St",
    city: "Austin",
    state: "TX",
    postalCode: "78701",
    country: "US",
    idNumber: "1234",
  });
  assert.equal(body.ssnLast4, "1234");
  assert.equal(body.idType, "ssn");
  assert.equal(body.idNumber, undefined);
});

test("shouldUseDesktopWalletLayout requires web desktop nav", () => {
  assert.equal(shouldUseDesktopWalletLayout("web", true), true);
  assert.equal(shouldUseDesktopWalletLayout("web", false), false);
  assert.equal(shouldUseDesktopWalletLayout("ios", true), false);
});

test("shouldShowPayoutSidePanel hides when ready or in play mode", () => {
  assert.equal(
    shouldShowPayoutSidePanel({
      liveWalletReady: true,
      isPlayMode: false,
      onboardingState: "needs_profile",
    }),
    true,
  );
  assert.equal(
    shouldShowPayoutSidePanel({
      liveWalletReady: true,
      isPlayMode: false,
      onboardingState: "ready",
    }),
    false,
  );
  assert.equal(
    shouldShowPayoutSidePanel({
      liveWalletReady: true,
      isPlayMode: true,
      onboardingState: "needs_profile",
    }),
    false,
  );
});

test("mapOnboardingLabelKey maps payout states to i18n keys", () => {
  assert.equal(mapOnboardingLabelKey("ready"), "payoutsEnabled");
  assert.equal(mapOnboardingLabelKey("needs_bank"), "needsBank");
  assert.equal(mapOnboardingLabelKey("needs_profile"), "needsProfile");
});

test("ecuador bank catalog has unique codes and swifts", () => {
  const codes = ECUADOR_BANKS.map((b) => b.code);
  const swifts = ECUADOR_BANKS.map((b) => b.swift);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(new Set(swifts).size, swifts.length);
  assert.equal(findEcuadorBank("pichincha")?.swift, "PICHECEQ");
});
