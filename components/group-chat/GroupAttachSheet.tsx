import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { useTranslation } from "react-i18next";
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type GroupAttachSheetProps = {
  visible: boolean;
  onClose: () => void;
  onInvite: () => void;
  onSendImage: () => void;
  onCreatePrediction: () => void;
  onSharePublicBet: () => void;
};

type AttachAction = {
  key: string;
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  labelKey: "attachInvite" | "attachSendImage" | "attachCreatePrediction" | "attachSharePublicBet";
  onPress: () => void;
  destructive?: boolean;
};

export function GroupAttachSheet({
  visible,
  onClose,
  onInvite,
  onSendImage,
  onCreatePrediction,
  onSharePublicBet,
}: GroupAttachSheetProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("groups");
  const insets = useSafeAreaInsets();

  const actions: AttachAction[] = [
    { key: "invite", icon: "list.bullet", labelKey: "attachInvite", onPress: onInvite },
    { key: "image", icon: "photo.fill", labelKey: "attachSendImage", onPress: onSendImage },
    {
      key: "prediction",
      icon: "plus.circle.fill",
      labelKey: "attachCreatePrediction",
      onPress: onCreatePrediction,
    },
    {
      key: "share",
      icon: "arrow.up.right.circle.fill",
      labelKey: "attachSharePublicBet",
      onPress: onSharePublicBet,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            theme.elevation("sm"),
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: theme.borderSubtle }]} />
          <Text style={[styles.title, { color: theme.textSecondary }]}>{t("attachSheetTitle")}</Text>

          {actions.map((action, index) => (
            <TouchableOpacity
              key={action.key}
              style={[
                styles.actionRow,
                {
                  borderBottomColor: theme.borderSubtle,
                  borderBottomWidth: index < actions.length - 1 ? StyleSheet.hairlineWidth : 0,
                },
                Platform.OS === "web" && ({ cursor: "pointer" } as const),
              ]}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={t(action.labelKey)}
            >
              <IconSymbol name={action.icon} size={22} color={theme.primary} />
              <Text style={[styles.actionText, { color: theme.text }]}>{t(action.labelKey)}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={[
              styles.cancelRow,
              Platform.OS === "web" && ({ cursor: "pointer" } as const),
            ]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t("attachCancel")}
          >
            <Text style={[styles.cancelText, { color: theme.destructive }]}>{t("attachCancel")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Layout mirrors ShareSheet — dedupe into AppBottomSheet if a third sheet appears.
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    marginBottom: 16,
  },
  title: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    paddingVertical: 12,
    gap: 12,
  },
  actionText: {
    fontSize: 17,
    fontWeight: "400",
  },
  cancelRow: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  cancelText: {
    fontSize: 17,
    fontWeight: "400",
  },
});
