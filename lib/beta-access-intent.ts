import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
    normalizeBetaAccessIntent,
    parseBetaAccessIntentRaw,
    type BetaAccessIntent,
} from "./beta-access-intent-core";

export { normalizeBetaAccessIntent, parseBetaAccessIntentRaw } from "./beta-access-intent-core";
export type { BetaAccessIntent, BetaAccessIntentStatus } from "./beta-access-intent-core";

const STORAGE_KEY = "@qbet/beta-access-intent";

async function readRaw(): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  }
  return AsyncStorage.getItem(STORAGE_KEY);
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, value);
    }
    return;
  }
  await AsyncStorage.setItem(STORAGE_KEY, value);
}

export async function getBetaAccessIntent(): Promise<BetaAccessIntent | null> {
  const raw = await readRaw();
  return parseBetaAccessIntentRaw(raw);
}

export async function saveBetaAccessIntent(
  intent: Omit<BetaAccessIntent, "updatedAt"> & { updatedAt?: string },
): Promise<void> {
  const payload = normalizeBetaAccessIntent(intent);
  await writeRaw(JSON.stringify(payload));
}

export async function clearBetaAccessIntent(): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    return;
  }
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function saveSubmittedIntent(email: string, requestId?: string): Promise<void> {
  await saveBetaAccessIntent({
    email,
    requestId,
    status: "submitted",
  });
}

export async function saveApprovedIntent(input: {
  email: string;
  requestId?: string;
  approvalToken?: string;
}): Promise<void> {
  await saveBetaAccessIntent({
    email: input.email,
    requestId: input.requestId,
    approvalToken: input.approvalToken,
    status: "approved",
  });
}
