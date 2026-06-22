import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import {
    CHAT_MESSAGE_MAX_LENGTH,
    getSendShortcutLabel,
    shouldSendChatMessage,
} from "@/lib/chat-composer";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface ChatComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void | Promise<void>;
  onAttachPress: () => void;
  isUploadingImage?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function ChatComposer({
  value,
  onChangeText,
  onSend,
  onAttachPress,
  isUploadingImage = false,
  placeholder = "Message",
  maxLength = CHAT_MESSAGE_MAX_LENGTH,
}: ChatComposerProps) {
  const { theme } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !isSending;
  const showCharCount = value.length >= maxLength * 0.85;
  const sendShortcut = getSendShortcutLabel();

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

  const webInputProps =
    Platform.OS === "web"
      ? ({
          onKeyDown: handleKeyDown,
        } as Record<string, unknown>)
      : {};

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
      <TouchableOpacity
        style={[styles.attachButton, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
        onPress={onAttachPress}
        accessibilityRole="button"
        accessibilityLabel="Attach file or action"
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
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: theme.text }, Platform.OS === "web" && ({ cursor: "text", outlineStyle: "none" } as any)]}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            multiline
            maxLength={maxLength}
            textAlignVertical="top"
            blurOnSubmit={false}
            editable={!isSending}
            accessibilityLabel="Message input"
            accessibilityHint={
              Platform.OS === "web"
                ? `${sendShortcut} to send. Enter adds a new line.`
                : "Type a message"
            }
            {...webInputProps}
          />
          {value.length > 0 && !isSending && (
            <TouchableOpacity
              style={[styles.clearButton, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
              onPress={() => onChangeText("")}
              accessibilityRole="button"
              accessibilityLabel="Clear message"
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
                {sendShortcut} to send · ↵ new line
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
          { backgroundColor: canSend ? theme.primary : theme.input },
          Platform.OS === "web" && ({ cursor: canSend ? "pointer" : "default" } as any),
        ]}
        onPress={() => void handleSend()}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send message"
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
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
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
    borderRadius: 22,
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
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
});
