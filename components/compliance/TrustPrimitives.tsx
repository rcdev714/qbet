import React from "react";
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from "react-native";

import { Typography } from "@/constants/typography";
import { useTheme } from "../../contexts/ThemeContext";

type Tone = "primary" | "success" | "warning" | "risk" | "neutral" | "info";

function colorForTone(theme: ReturnType<typeof useTheme>["theme"], tone: Tone) {
  switch (tone) {
    case "success":
      return theme.success;
    case "warning":
      return theme.warning;
    case "risk":
      return theme.error;
    case "info":
      return theme.primary;
    case "neutral":
      return theme.textSecondary;
    default:
      return theme.primary;
  }
}

export function TrustBadge({
  label,
  tone = "primary",
  style,
}: {
  label: string;
  tone?: Tone;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  const color = colorForTone(theme, tone);

  return (
    <View style={[styles.badge, { backgroundColor: `${color}18`, borderColor: `${color}44` }, style]}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function RiskNotice({
  title,
  body,
  tone = "risk",
  style,
}: {
  title: string;
  body: string;
  tone?: Tone;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  const color = colorForTone(theme, tone);

  return (
    <View style={[styles.notice, { backgroundColor: `${color}12`, borderColor: `${color}40` }, style]}>
      <Text style={[styles.noticeTitle, { color }]}>{title}</Text>
      <Text style={[styles.noticeBody, { color: theme.textSecondary }]}>{body}</Text>
    </View>
  );
}

export function MarketRuleCard({
  label,
  value,
  detail,
  tone = "neutral",
  style,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: Tone;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  const color = colorForTone(theme, tone);

  return (
    <View style={[styles.ruleCard, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      <Text style={[styles.ruleLabel, { color }]}>{label}</Text>
      <Text style={[styles.ruleValue, { color: theme.text }]}>{value}</Text>
      {detail ? <Text style={[styles.ruleDetail, { color: theme.textSecondary }]}>{detail}</Text> : null}
    </View>
  );
}

export function VerificationStatusCard({
  title,
  body,
  status,
  tone = "info",
}: {
  title: string;
  body: string;
  status: string;
  tone?: Tone;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.verificationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, { color: theme.text }]}>{title}</Text>
        <TrustBadge label={status} tone={tone} />
      </View>
      <Text style={[styles.cardBody, { color: theme.textSecondary }]}>{body}</Text>
    </View>
  );
}

export function SectionEyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  const { theme } = useTheme();

  return <Text style={[styles.eyebrow, { color: theme.primary }, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    ...Typography.label,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  noticeTitle: {
    ...Typography.label,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  noticeBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  ruleCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  ruleLabel: {
    ...Typography.label,
    fontSize: 11,
    letterSpacing: 0.7,
  },
  ruleValue: {
    ...Typography.emphasis,
    fontSize: 16,
  },
  ruleDetail: {
    fontSize: 12,
    lineHeight: 17,
  },
  verificationCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  cardTitle: {
    ...Typography.heading,
    flex: 1,
    fontSize: 17,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  eyebrow: {
    ...Typography.label,
    fontSize: 12,
    letterSpacing: 1,
  },
});
