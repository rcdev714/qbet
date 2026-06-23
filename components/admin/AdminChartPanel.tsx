import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";

export type ChartRange = 7 | 14 | 30;

type AdminChartPanelProps = {
  title: string;
  subtitle?: string;
  range?: ChartRange;
  onRangeChange?: (range: ChartRange) => void;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  empty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
};

const RANGE_OPTIONS: ChartRange[] = [7, 14, 30];

export function AdminChartPanel({
  title,
  subtitle,
  range,
  onRangeChange,
  headerRight,
  footer,
  empty,
  emptyMessage,
  children,
}: AdminChartPanelProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("admin");
  const resolvedEmptyMessage = emptyMessage ?? t("noChartData");

  return (
    <View style={[styles.panel, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="title3" style={{ color: theme.text }}>{title}</AppText>
          {subtitle ? (
            <AppText variant="bodySm" color="secondary" style={{ marginTop: 4 }}>{subtitle}</AppText>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          {headerRight}
          {range != null && onRangeChange ? (
            <View style={[styles.rangeRow, { backgroundColor: theme.background }]}>
              {RANGE_OPTIONS.map((option) => {
                const active = range === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => onRangeChange(option)}
                    style={[
                      styles.rangePill,
                      active && { backgroundColor: theme.primarySoft, borderColor: theme.primary },
                    ]}
                    activeOpacity={0.85}
                  >
                    <AppText variant="caption" style={{ color: active ? theme.primary : theme.textSecondary, fontWeight: '400' }}>
                      {option}D
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>

      {empty ? (
        <View style={styles.empty}>
          <AppText variant="bodySm" color="secondary">{resolvedEmptyMessage}</AppText>
        </View>
      ) : (
        <View style={styles.chartSlot}>{children}</View>
      )}

      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" } as any)
      : {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  headerText: {
    flex: 1,
    minWidth: 160,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 15,
    fontWeight: "400",
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  rangeRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  rangePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    ...(Platform.OS === "web" && ({ cursor: "pointer" } as any)),
  },
  rangeLabel: {
    fontSize: 11,
    fontWeight: '400',
  },
  chartSlot: {
    overflow: "hidden",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
});

export function formatAdminCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatAdminCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return formatAdminCurrency(value);
}

export function buildDayLabels(dates: string[]): string[] {
  return dates.map((date) => {
    const d = new Date(`${date}T12:00:00`);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });
}

export function buildSparseDayLabels(dates: string[]): string[] {
  const step = Math.max(1, Math.ceil(dates.length / 6));
  return dates.map((date, index) => {
    if (index === 0 || index === dates.length - 1 || index % step === 0) {
      const d = new Date(`${date}T12:00:00`);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    return "";
  });
}
