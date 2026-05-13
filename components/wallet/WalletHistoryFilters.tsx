import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type WalletHistoryFilter = "all" | "transfers" | "deposits" | "withdrawals" | "bets";

interface WalletHistoryFiltersProps {
  value: WalletHistoryFilter;
  onChange: (next: WalletHistoryFilter) => void;
  theme: {
    textSecondary: string;
    primary: string;
  };
}

const FILTERS: { key: WalletHistoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "transfers", label: "Transfers" },
  { key: "deposits", label: "Deposits" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "bets", label: "Bets" },
];

export function WalletHistoryFilters({
  value,
  onChange,
  theme,
}: WalletHistoryFiltersProps) {
  return (
    <View style={styles.row}>
      {FILTERS.map((filter) => {
        const active = filter.key === value;
        return (
          <TouchableOpacity key={filter.key} onPress={() => onChange(filter.key)}>
            <Text
              style={[
                styles.label,
                { color: active ? theme.primary : theme.textSecondary },
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
});
