import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { ACTIVE_OPACITY } from "@/constants/motion";
import { useTheme } from "@/contexts/ThemeContext";

import { AppText } from "./AppText";

export interface ModalHeaderProps {
  title: string;
  onClose: () => void;
  closeLabel?: string;
}

export function ModalHeader({ title, onClose, closeLabel = "Close" }: ModalHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: theme.borderSubtle }]}>
      <AppText variant="title3" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        activeOpacity={ACTIVE_OPACITY}
        onPress={onClose}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <AppText variant="body" color="primary">
          {closeLabel}
        </AppText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    flex: 1,
    marginRight: 12,
  },
});
