import AsyncStorage from "@react-native-async-storage/async-storage";

import { pushRecentSticker } from "./stickers";

const RECENT_STICKERS_KEY = "@anymarkt/recent-stickers";

export async function loadRecentStickers(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_STICKERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, 16);
  } catch {
    return [];
  }
}

export async function rememberSticker(content: string): Promise<string[]> {
  const recent = pushRecentSticker(await loadRecentStickers(), content);
  try {
    await AsyncStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(recent));
  } catch {
    // Recents are a local convenience. Sending still succeeds.
  }
  return recent;
}
