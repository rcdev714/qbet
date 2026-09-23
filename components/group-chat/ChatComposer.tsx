import { MentionPicker, type MentionContext } from "@/components/chat/MentionPicker";
import { selectAndRememberSticker, StickerTray } from "@/components/chat/StickerTray";
import { AppIconButton } from "@/components/ui/AppIconButton";
import { AppText } from "@/components/ui/AppText";
import { ChatMessageInput } from "@/components/ui/ChatMessageInput";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CHAT_LIST_PADDING_X, resolveGutter } from "@/constants/layout";
import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";
import { useTheme } from "@/contexts/ThemeContext";
import {
  CHAT_MESSAGE_MAX_LENGTH,
  getSendShortcutLabel,
  shouldSendChatMessage,
} from "@/lib/chat-composer";
import { detectMentionQuery, stripMentionTrigger } from "@/lib/mentions";
import type { MentionEmbedPayload } from "@/types/mention";
import type { Sticker } from "@/lib/social/stickers";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void | Promise<void>;
  onAttachPress: () => void;
  isUploadingImage?: boolean;
  placeholder?: string;
  maxLength?: number;
  mentionContext?: MentionContext;
  onSendMention?: (payload: MentionEmbedPayload) => void | Promise<void>;
  onSendSticker?: (content: string) => void | Promise<void>;
}

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onAttachPress,
  isUploadingImage = false,
  placeholder,
  maxLength = CHAT_MESSAGE_MAX_LENGTH,
  mentionContext,
  onSendMention,
  onSendSticker,
}: ChatComposerProps) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktopWebNav = useIsDesktopWebNav();
  const { t } = useTranslation("groups");
  const insets = useSafeAreaInsets();
  const inputRef = useRef<React.ElementRef<typeof ChatMessageInput>>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | undefined>(undefined);
  const [stickersOpen, setStickersOpen] = useState(false);
  const horizontalPad = isDesktopWebNav ? CHAT_LIST_PADDING_X : resolveGutter(width);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !isSending;
  const showCharCount = value.length >= maxLength * 0.85;
  const sendShortcut = getSendShortcutLabel();
  const resolvedPlaceholder = placeholder ?? t("chatPlaceholder");

  const mentionState = useMemo(
    () => (onSendMention ? detectMentionQuery(value, selectionStart) : null),
    [value, selectionStart, onSendMention],
  );

  const handleSendSticker = useCallback(async (sticker: Sticker) => {
    if (!onSendSticker || isSending) return;
    setIsSending(true);
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      const content = await selectAndRememberSticker(sticker);
      await Promise.resolve(onSendSticker(content));
    } finally {
      setIsSending(false);
    }
  }, [isSending, onSendSticker]);

  const handleSend = useCallback(async () => {
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      if (Platform.OS !== "web") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      await Promise.resolve(onSend());
      if (Platform.OS === "web") {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    } finally {
      setIsSending(false);
    }
  }, [trimmed, isSending, onSend]);

  const handleKeyDown = useCallback(
    (event: { key: string; metaKey?: boolean; ctrlKey?: boolean; preventDefault?: () => void }) => {
      if (!shouldSendChatMessage(event)) return;
      event.preventDefault?.();
      void handleSend();
    },
    [handleSend],
  );

  const handleSelectMention = useCallback(
    async (payload: MentionEmbedPayload) => {
      if (!mentionState || !onSendMention) return;
      onChangeText(stripMentionTrigger(value, mentionState.triggerStart));
      await Promise.resolve(onSendMention(payload));
      if (Platform.OS === "web") {
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [mentionState, onSendMention, onChangeText, value],
  );

  const webInputProps =
    Platform.OS === "web"
      ? ({
          onKeyDown: handleKeyDown,
        } as Record<string, unknown>)
      : {};

  const rightAction = canSend ? (
    <AppIconButton
      accessibilityLabel={t("chatSendA11y")}
      onPress={() => void handleSend()}
      icon={
        isSending ? (
          <ActivityIndicator size="small" color={theme.onPrimary} />
        ) : (
          <IconSymbol name="paperplane.fill" size={20} color={theme.onPrimary} />
        )
      }
      style={{ backgroundColor: theme.primary, borderRadius: theme.radius.pill }}
    />
  ) : (
    <AppIconButton
      accessibilityLabel={t("chatAttachA11y")}
      onPress={onAttachPress}
      disabled={isUploadingImage}
      icon={
        isUploadingImage ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <IconSymbol name="mic.fill" size={20} color={theme.textSecondary} />
        )
      }
      variant="ghost"
    />
  );

  return (
    <View style={styles.composerStack}>
      {onSendSticker ? (
        <StickerTray
          visible={stickersOpen}
          onClose={() => setStickersOpen(false)}
          onSelect={(sticker) => void handleSendSticker(sticker)}
        />
      ) : null}

      {mentionState?.active && mentionContext && onSendMention ? (
        <MentionPicker
          visible
          query={mentionState.query}
          context={mentionContext}
          onSelect={(payload) => void handleSelectMention(payload)}
          onClose={() => undefined}
        />
      ) : null}

      {showCharCount ? (
        <View style={[styles.charCountRow, { paddingHorizontal: horizontalPad }]}>
          <AppText
            variant="caption"
            color={value.length >= maxLength ? "destructive" : "secondary"}
          >
            {value.length}/{maxLength}
          </AppText>
        </View>
      ) : null}

      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingHorizontal: horizontalPad,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <AppIconButton
          accessibilityLabel={t("chatAttachA11y")}
          accessibilityHint={t("chatAttachHint")}
          onPress={onAttachPress}
          disabled={isUploadingImage}
          icon={
            isUploadingImage ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <IconSymbol name="plus" size={22} color={theme.primary} />
            )
          }
          variant="ghost"
        />

        {onSendSticker ? (
          <AppIconButton
            accessibilityLabel={t("stickerTrayA11y")}
            onPress={() => {
              setStickersOpen((open) => !open);
              inputRef.current?.blur();
            }}
            icon={<IconSymbol name="sparkles" size={22} color={theme.primary} />}
            variant="ghost"
          />
        ) : null}

        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: theme.input,
              borderColor: isFocused ? theme.primary : "transparent",
              borderRadius: theme.radius.pill,
            },
          ]}
        >
          <ChatMessageInput
            ref={inputRef}
            placeholder={resolvedPlaceholder}
            placeholderTextColor={theme.textSecondary}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onSelectionChange={(event) => {
              setSelectionStart(event.nativeEvent.selection.start);
            }}
            multiline
            maxLength={maxLength}
            textAlignVertical="center"
            blurOnSubmit={false}
            editable={!isSending}
            accessibilityLabel={t("chatInputA11y")}
            accessibilityHint={
              Platform.OS === "web"
                ? t("chatInputHintWeb", { shortcut: sendShortcut })
                : t("chatInputHintNative")
            }
            {...webInputProps}
          />
        </View>

        {rightAction}
      </View>

      {isFocused && Platform.OS === "web" && sendShortcut ? (
        <AppText variant="caption" color="secondary" style={[styles.shortcutHint, { paddingHorizontal: horizontalPad }]}>
          {t("chatShortcutHint", { shortcut: sendShortcut })}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  composerStack: {
    width: "100%",
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    maxHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
  },
  charCountRow: {
    alignItems: "flex-end",
    paddingTop: 4,
    paddingBottom: 2,
  },
  shortcutHint: {
    paddingTop: 4,
    paddingBottom: 2,
  },
});
