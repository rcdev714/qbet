import { MentionPicker, type MentionContext } from "@/components/chat/MentionPicker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import {
    CHAT_MESSAGE_MAX_LENGTH,
    getSendShortcutLabel,
    shouldSendChatMessage,
} from "@/lib/chat-composer";
import { detectMentionQuery, stripMentionTrigger } from "@/lib/mentions";
import type { MentionEmbedPayload } from "@/types/mention";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
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
}: ChatComposerProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("groups");
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | undefined>(undefined);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !isSending;
  const showCharCount = value.length >= maxLength * 0.85;
  const sendShortcut = getSendShortcutLabel();
  const resolvedPlaceholder = placeholder ?? t("chatPlaceholder");

  const mentionState = useMemo(
    () => (onSendMention ? detectMentionQuery(value, selectionStart) : null),
    [value, selectionStart, onSendMention],
  );

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

  return (
    <View style={styles.composerStack}>
      {mentionState?.active && mentionContext && onSendMention ? (
        <MentionPicker
          visible
          query={mentionState.query}
          context={mentionContext}
          onSelect={(payload) => void handleSelectMention(payload)}
          onClose={() => undefined}
        />
      ) : null}

      <View
        style={[
          styles.container,
          theme.elevation("sm"),
          {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            paddingBottom: Math.max(insets.bottom, theme.spacing.sm),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.attachButton, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
          onPress={onAttachPress}
          accessibilityRole="button"
          accessibilityLabel={t("chatAttachA11y")}
          accessibilityHint={t("chatAttachHint")}
        >
          {isUploadingImage ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <IconSymbol name="plus.circle" size={26} color={theme.primary} />
          )}
        </TouchableOpacity>

        <View style={styles.inputColumn}>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: theme.input,
                borderColor: isFocused ? theme.primary : theme.border,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.text }, Platform.OS === "web" && ({ cursor: "text", outlineStyle: "none" } as any)]}
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
              textAlignVertical="top"
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
            {value.length > 0 && !isSending && (
              <TouchableOpacity
                style={[styles.clearButton, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
                onPress={() => onChangeText("")}
                accessibilityRole="button"
                accessibilityLabel={t("chatClearA11y")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <IconSymbol name="xmark.circle.fill" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {(isFocused || showCharCount) && (
            <View style={styles.inputMeta}>
              {isFocused && Platform.OS === "web" && sendShortcut ? (
                <Text style={[styles.shortcutHint, { color: theme.textSecondary }]}>
                  {t("chatShortcutHint", { shortcut: sendShortcut })}
                </Text>
              ) : (
                <View />
              )}
              {showCharCount && (
                <Text
                  style={[
                    styles.charCount,
                    {
                      color: value.length >= maxLength ? theme.error : theme.textSecondary,
                    },
                  ]}
                >
                  {value.length}/{maxLength}
                </Text>
              )}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: canSend ? theme.primary : theme.input,
              borderRadius: theme.radius.pill,
            },
            Platform.OS === "web" && ({ cursor: canSend ? "pointer" : "default" } as any),
          ]}
          onPress={() => void handleSend()}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t("chatSendA11y")}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={theme.onPrimary} />
          ) : (
            <IconSymbol
              name="paperplane.fill"
              size={18}
              color={canSend ? theme.onPrimary : theme.textSecondary}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composerStack: {
    width: "100%",
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  attachButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  inputColumn: {
    flex: 1,
    minWidth: 0,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    maxHeight: 140,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 16,
    maxHeight: 112,
    lineHeight: 21,
    paddingTop: 0,
    paddingBottom: 0,
  },
  clearButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Platform.OS === "ios" ? 0 : 1,
  },
  inputMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingTop: 4,
    minHeight: 16,
  },
  shortcutHint: {
    fontSize: 11,
    fontWeight: "500",
  },
  charCount: {
    fontSize: 11,
    fontWeight: "500",
    marginLeft: "auto",
  },
  sendButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
});
