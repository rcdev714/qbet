/**
 * Curated sticker messages shared with web.
 *
 * Row shape on `messages` and `market_chat_messages`:
 *   message_type = 'sticker'
 *   content      = 'sticker:<pack>:<slug>'
 *
 * Both clients render a known id as its emoji. An unknown id still renders
 * as a sticker, not as chat text. Custom uploads are not part of this contract.
 */

export interface Sticker {
  pack: string;
  slug: string;
  emoji: string;
  label: string;
  labelKey: string;
}

export interface StickerPack {
  id: string;
  titleKey: "stickerPackOdds" | "stickerPackReactions";
  stickers: Sticker[];
}

const RAW: { pack: string; slug: string; emoji: string; label: string; labelKey: string }[] = [
  { pack: "odds", slug: "rocket", emoji: "🚀", label: "To the moon", labelKey: "stickerOddsRocket" },
  { pack: "odds", slug: "chart", emoji: "📈", label: "Chart up", labelKey: "stickerOddsChart" },
  { pack: "odds", slug: "target", emoji: "🎯", label: "On target", labelKey: "stickerOddsTarget" },
  { pack: "odds", slug: "trophy", emoji: "🏆", label: "Trophy", labelKey: "stickerOddsTrophy" },
  { pack: "odds", slug: "fire", emoji: "🔥", label: "On fire", labelKey: "stickerOddsFire" },
  { pack: "odds", slug: "eyes", emoji: "👀", label: "Watching", labelKey: "stickerOddsEyes" },
  { pack: "odds", slug: "clown", emoji: "🤡", label: "Clown market", labelKey: "stickerOddsClown" },
  { pack: "odds", slug: "coin", emoji: "🪙", label: "Coin flip", labelKey: "stickerOddsCoin" },
  { pack: "reactions", slug: "laugh", emoji: "😂", label: "Laugh", labelKey: "stickerReactionsLaugh" },
  { pack: "reactions", slug: "think", emoji: "🤔", label: "Thinking", labelKey: "stickerReactionsThink" },
  { pack: "reactions", slug: "pray", emoji: "🙏", label: "Please", labelKey: "stickerReactionsPray" },
  { pack: "reactions", slug: "hundred", emoji: "💯", label: "Hundred", labelKey: "stickerReactionsHundred" },
  { pack: "reactions", slug: "skull", emoji: "💀", label: "Dead", labelKey: "stickerReactionsSkull" },
  { pack: "reactions", slug: "heart", emoji: "❤️", label: "Heart", labelKey: "stickerReactionsHeart" },
  { pack: "reactions", slug: "wave", emoji: "👋", label: "Wave", labelKey: "stickerReactionsWave" },
  { pack: "reactions", slug: "party", emoji: "🎉", label: "Party", labelKey: "stickerReactionsParty" },
];

export const STICKER_PACKS: StickerPack[] = [
  {
    id: "odds",
    titleKey: "stickerPackOdds",
    stickers: RAW.filter((sticker) => sticker.pack === "odds"),
  },
  {
    id: "reactions",
    titleKey: "stickerPackReactions",
    stickers: RAW.filter((sticker) => sticker.pack === "reactions"),
  },
];

export const STICKERS: Sticker[] = STICKER_PACKS.flatMap((pack) => pack.stickers);

const STICKER_CONTENT = /^sticker:([a-z0-9_-]+):([a-z0-9_-]+)$/;

export function stickerContent(sticker: Pick<Sticker, "pack" | "slug">): string {
  return `sticker:${sticker.pack}:${sticker.slug}`;
}

export function parseStickerContent(content: string | null | undefined): {
  pack: string;
  slug: string;
  sticker: Sticker | null;
} | null {
  const match = content?.trim().match(STICKER_CONTENT);
  if (!match) return null;
  const pack = match[1];
  const slug = match[2];
  const sticker = STICKERS.find((item) => item.pack === pack && item.slug === slug) ?? null;
  return { pack, slug, sticker };
}

export function stickerPreview(content: string | null | undefined): string {
  const parsed = parseStickerContent(content);
  if (!parsed) return "Sticker";
  return parsed.sticker?.label ?? "Sticker";
}

export function pushRecentSticker(recent: readonly string[], content: string, limit = 16): string[] {
  const next = [content, ...recent.filter((id) => id !== content)];
  return next.slice(0, limit);
}
