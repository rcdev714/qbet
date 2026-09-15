import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { SETTLEMENT_FEEDBACK_DISMISS_KEY } from "./feedback-constants";

type DismissMap = Record<string, true>;

async function readDismissMap(): Promise<DismissMap> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage === "undefined") return {};
      const raw = localStorage.getItem(SETTLEMENT_FEEDBACK_DISMISS_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as DismissMap;
    }
    const raw = await AsyncStorage.getItem(SETTLEMENT_FEEDBACK_DISMISS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as DismissMap;
  } catch {
    return {};
  }
}

async function writeDismissMap(map: DismissMap): Promise<void> {
  const serialized = JSON.stringify(map);
  if (Platform.OS === "web") {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(SETTLEMENT_FEEDBACK_DISMISS_KEY, serialized);
      }
    } catch {
      // Ignore storage failures; prompt may reappear.
    }
    return;
  }
  await AsyncStorage.setItem(SETTLEMENT_FEEDBACK_DISMISS_KEY, serialized);
}

export async function isSettlementFeedbackDismissed(marketId: string): Promise<boolean> {
  const map = await readDismissMap();
  return map[marketId] === true;
}

export async function dismissSettlementFeedback(marketId: string): Promise<void> {
  const map = await readDismissMap();
  map[marketId] = true;
  await writeDismissMap(map);
}

export async function filterUndismissedMarketIds(marketIds: string[]): Promise<string[]> {
  if (marketIds.length === 0) return [];
  const map = await readDismissMap();
  return marketIds.filter((id) => map[id] !== true);
}
