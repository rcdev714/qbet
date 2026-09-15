import React from "react";
import { StyleSheet, View } from "react-native";

import { SegmentedControl } from "@/components/ui/SegmentedControl";

export type WalletActionKey = "deposit" | "send" | "receive" | "withdraw";

interface WalletActionRailProps {
  active: WalletActionKey;
  onSelect: (action: WalletActionKey) => void;
}

const ACTIONS: { value: WalletActionKey; label: string }[] = [
  { value: "deposit", label: "Add Funds" },
  { value: "send", label: "Send" },
  { value: "receive", label: "Receive" },
  { value: "withdraw", label: "Withdraw" },
];

export function WalletActionRail({ active, onSelect }: WalletActionRailProps) {
  return (
    <View style={styles.container}>
      <SegmentedControl compact value={active} segments={ACTIONS} onChange={onSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
});
