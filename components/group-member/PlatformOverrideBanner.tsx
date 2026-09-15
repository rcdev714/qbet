import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

type PlatformOverrideBannerProps = {
  status?: "none" | "frozen" | "voided" | "corrected" | "challenged";
};

export function PlatformOverrideBanner({ status = "none" }: PlatformOverrideBannerProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("groupMember");

  if (status === "none") return null;

  return (
    <View style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.warning }]}>
      <AppText variant="bodySm">{t("challengedTitle")}</AppText>
      <AppText variant="caption" color="secondary">
        {t("challengedBody")}
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
