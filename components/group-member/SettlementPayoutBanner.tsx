import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { formatIncomingReleaseDate } from "@/lib/settlement/payout-hold-constants";
import type { SettlementOverrideStatus, SettlementPayoutStatus } from "@/types/settlement-governance";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

type SettlementPayoutBannerProps = {
  payoutStatus?: SettlementPayoutStatus | string | null;
  payoutReleaseAt?: string | null;
  overrideStatus?: SettlementOverrideStatus | string | null;
  locale?: string;
};

export function SettlementPayoutBanner({
  payoutStatus,
  payoutReleaseAt,
  overrideStatus = "none",
  locale = "en-US",
}: SettlementPayoutBannerProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("groupMember");

  const isPaused =
    payoutStatus === "held" ||
    overrideStatus === "challenged" ||
    overrideStatus === "frozen";

  const isPendingRelease = payoutStatus === "pending_release" && !isPaused;

  if (!isPendingRelease && !isPaused) return null;

  const releaseLabel = payoutReleaseAt
    ? formatIncomingReleaseDate(payoutReleaseAt, locale)
    : null;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: theme.surface,
          borderColor: isPaused ? theme.warning : theme.primary,
        },
      ]}
    >
      <AppText variant="bodySm">
        {isPaused ? t("payoutPausedTitle") : t("payoutPendingTitle")}
      </AppText>
      <AppText variant="caption" color="secondary">
        {isPaused
          ? t("payoutPausedBody")
          : releaseLabel
            ? t("payoutPendingBody", { date: releaseLabel })
            : t("payoutPendingBodyGeneric")}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    marginHorizontal: 12,
    marginBottom: 8,
  },
});
