import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { getAuraTier } from "@/lib/aura";
import React from "react";
import { StyleSheet, View } from "react-native";

interface AuraBadgeProps {
  winRate: number | null | undefined;
  compact?: boolean;
}

export function AuraBadge({ winRate, compact = false }: AuraBadgeProps) {
  const { theme } = useTheme();
  const tier = getAuraTier(winRate);

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: theme.primarySoft, borderColor: theme.primary },
      ]}
    >
      <AppText variant="caption" style={{ color: theme.primary, fontSize: compact ? 10 : 11 }}>
        {tier.name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
});
