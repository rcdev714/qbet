import { AppIconButton } from "@/components/ui/AppIconButton";
import { AppText } from "@/components/ui/AppText";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import { loadRecentStickers, rememberSticker } from "@/lib/social/recent-stickers";
import {
  STICKER_PACKS,
  STICKERS,
  parseStickerContent,
  stickerContent,
  type Sticker,
} from "@/lib/social/stickers";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

interface StickerTrayProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (sticker: Sticker) => void;
}

export function StickerMessage({ content }: { content: string | null | undefined }) {
  const { t } = useTranslation("groups");
  const parsed = parseStickerContent(content);
  const emoji = parsed?.sticker?.emoji ?? "🏷️";
  const label = parsed?.sticker
    ? t(parsed.sticker.labelKey, { defaultValue: parsed.sticker.label })
    : t("stickerMessage");

  return (
    <AppText
      accessibilityLabel={label}
      style={styles.stickerEmoji}
    >
      {emoji}
    </AppText>
  );
}

export function StickerTray({ visible, onClose, onSelect }: StickerTrayProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("groups");
  const { width } = useWindowDimensions();
  const [packId, setPackId] = useState<string>("odds");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void loadRecentStickers().then((ids) => {
      if (!cancelled) setRecent(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const columns = Math.max(4, Math.min(8, Math.floor((width - 24) / 52)));
  const recentStickers = useMemo(
    () =>
      recent
        .map((content) => parseStickerContent(content)?.sticker)
        .filter((sticker): sticker is Sticker => Boolean(sticker)),
    [recent],
  );
  const stickers = packId === "recent"
    ? recentStickers
    : STICKER_PACKS.find((pack) => pack.id === packId)?.stickers ?? STICKERS;

  if (!visible) return null;

  return (
    <View
      style={[styles.tray, { backgroundColor: theme.surface, borderTopColor: theme.border }]}
      accessibilityRole="menu"
      accessibilityLabel={t("stickerTrayA11y")}
    >
      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("stickerRecent")}
          onPress={() => setPackId("recent")}
          style={[
            styles.tab,
            { borderColor: packId === "recent" ? theme.primary : theme.border },
          ]}
        >
          <AppText variant="caption">{t("stickerRecent")}</AppText>
        </Pressable>
        {STICKER_PACKS.map((pack) => (
          <Pressable
            key={pack.id}
            accessibilityRole="button"
            accessibilityLabel={t(pack.titleKey)}
            onPress={() => setPackId(pack.id)}
            style={[
              styles.tab,
              { borderColor: packId === pack.id ? theme.primary : theme.border },
            ]}
          >
            <AppText variant="caption">{t(pack.titleKey)}</AppText>
          </Pressable>
        ))}
        <AppIconButton
          accessibilityLabel={t("stickerCloseA11y")}
          onPress={onClose}
          icon={<IconSymbol name="xmark" size={18} color={theme.textSecondary} />}
          variant="ghost"
        />
      </View>
      <View style={styles.grid}>
        {stickers.map((sticker) => {
          const label = t(sticker.labelKey, { defaultValue: sticker.label });
          return (
            <Pressable
              key={stickerContent(sticker)}
              accessibilityRole="button"
              accessibilityLabel={t("stickerSendA11y", { label })}
              onPress={() => onSelect(sticker)}
              style={[styles.cell, { width: `${100 / columns}%` }]}
            >
              <AppText style={styles.cellEmoji}>{sticker.emoji}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export async function selectAndRememberSticker(sticker: Sticker): Promise<string> {
  const content = stickerContent(sticker);
  await rememberSticker(content);
  return content;
}

const styles = StyleSheet.create({
  tray: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabs: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
  },
  cell: {
    minHeight: 44,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  cellEmoji: {
    fontSize: 28,
    lineHeight: 34,
  },
  stickerEmoji: {
    fontSize: 48,
    lineHeight: 56,
  },
});
