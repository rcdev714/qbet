import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type WalletActionKey = "deposit" | "send" | "receive" | "withdraw";

interface WalletActionRailProps {
  active: WalletActionKey;
  onSelect: (action: WalletActionKey) => void;
  theme: {
    surface: string;
    border: string;
    text: string;
    textSecondary: string;
    primary: string;
  };
}

const ACTIONS: { key: WalletActionKey; label: string }[] = [
  { key: "deposit", label: "Add Funds" },
  { key: "send", label: "Send" },
  { key: "receive", label: "Receive" },
  { key: "withdraw", label: "Withdraw" },
];

export function WalletActionRail({
  active,
  onSelect,
  theme,
}: WalletActionRailProps) {
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      {ACTIONS.map((action) => {
        const isActive = action.key === active;
        return (
          <TouchableOpacity
            key={action.key}
            onPress={() => onSelect(action.key)}
            style={[
              styles.item,
              isActive && { backgroundColor: `${theme.primary}1A` },
            ]}
          >
            <Text
              style={[
                styles.itemText,
                { color: isActive ? theme.primary : theme.textSecondary },
              ]}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 6,
    marginBottom: 14,
  },
  item: {
    flex: 1,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  itemText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
