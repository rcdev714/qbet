import React from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { formatCurrency } from "../lib/parimutuel";

interface ModeToggleProps {
  isPlayMode: boolean;
  onToggle: () => void;
  playBalance: number;
  liveBalance: number;
  compact?: boolean;
}

export function ModeToggle({
  isPlayMode,
  onToggle,
  playBalance,
  liveBalance,
  compact = false,
}: ModeToggleProps) {
  const { theme } = useTheme();

  const activeBalance = isPlayMode ? playBalance : liveBalance;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View
        style={[
          styles.toggleContainer,
          { backgroundColor: theme.input, borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.toggleOption,
            isPlayMode && styles.activeOption,
            isPlayMode && { backgroundColor: theme.primary },
          ]}
          onPress={() => !isPlayMode && onToggle()}
          activeOpacity={0.8}
        >
          <Text style={styles.toggleIcon}>🎮</Text>
          <Text
            style={[
              styles.toggleText,
              { color: isPlayMode ? theme.onPrimary : theme.textSecondary },
            ]}
          >
            PLAY
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleOption,
            !isPlayMode && styles.activeOption,
            !isPlayMode && { backgroundColor: theme.success },
          ]}
          onPress={() => isPlayMode && onToggle()}
          activeOpacity={0.8}
        >
          <Text style={styles.toggleIcon}>💰</Text>
          <Text
            style={[
              styles.toggleText,
              { color: !isPlayMode ? theme.onPrimary : theme.textSecondary },
            ]}
          >
            LIVE
          </Text>
        </TouchableOpacity>
      </View>

      {!compact && (
        <View style={styles.balanceContainer}>
          <Text style={[styles.balanceLabel, { color: theme.textSecondary }]}>
            {isPlayMode ? "Play Credits" : "Live Balance"}
          </Text>
          <Text
            style={[
              styles.balanceAmount,
              { color: isPlayMode ? theme.primary : theme.success },
            ]}
          >
            {formatCurrency(activeBalance)}
          </Text>
          {isPlayMode && (
            <Text style={[styles.balanceNote, { color: theme.textSecondary }]}>
              Practice with fake money
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 16,
  },
  containerCompact: {
    paddingVertical: 8,
  },
  toggleContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  toggleOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
  },
  activeOption: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleIcon: {
    fontSize: 16,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  balanceContainer: {
    alignItems: "center",
    marginTop: 16,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "300",
    marginTop: 4,
  },
  balanceNote: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
});
