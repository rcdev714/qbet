import { ModalHeader } from "@/components/ui/ModalHeader";
import { AppButton } from "@/components/ui/AppButton";
import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

interface GroupFlowSheetProps {
  visible: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function GroupFlowSheet({
  visible,
  title,
  closeLabel,
  onClose,
  onBack,
  backLabel,
  children,
  footer,
}: GroupFlowSheetProps) {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onBack ?? onClose}
    >
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: theme.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ModalHeader title={title} closeLabel={closeLabel} onClose={onClose} />
        {onBack && backLabel ? (
          <View style={styles.backRow}>
            <AppButton title={backLabel} variant="ghost" onPress={onBack} />
          </View>
        ) : null}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? <View style={[styles.footer, { borderTopColor: theme.border }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backRow: {
    paddingHorizontal: 12,
    alignItems: "flex-start",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
