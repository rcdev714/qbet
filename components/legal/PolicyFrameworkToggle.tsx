import React from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { usePolicyFramework } from "@/contexts/PolicyFrameworkContext";
import type { ComplianceJurisdiction } from "@/lib/compliance/jurisdiction";
import { LEGAL_COLORS, LEGAL_TYPE, legalFont } from "@/lib/legal/typography";

type PolicyFrameworkToggleProps = {
  fontsLoaded?: boolean;
};

const OPTIONS: ComplianceJurisdiction[] = ["US", "EC"];

export function PolicyFrameworkToggle({ fontsLoaded = true }: PolicyFrameworkToggleProps) {
  const { viewJurisdiction, setViewJurisdiction } = usePolicyFramework();
  const { t } = useTranslation("compliance");

  return (
    <View
      style={styles.container}
      accessibilityRole="tablist"
      accessibilityLabel={t("frameworkToggleLabel")}
    >
      {OPTIONS.map((option) => {
        const selected = viewJurisdiction === option;
        return (
          <Pressable
            key={option}
            onPress={() => setViewJurisdiction(option)}
            style={[
              styles.option,
              selected && styles.optionSelected,
              Platform.OS === "web" && ({ cursor: "pointer" } as any),
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option === "US" ? t("frameworkUs") : t("frameworkEc")}
          >
            <Text
              style={[
                styles.optionText,
                { fontFamily: legalFont("uiSemiBold", fontsLoaded) },
                selected && styles.optionTextSelected,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: LEGAL_COLORS.rule,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: LEGAL_COLORS.paperBg,
  },
  option: {
    minWidth: 44,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  optionSelected: {
    backgroundColor: LEGAL_COLORS.ink,
  },
  optionText: {
    ...LEGAL_TYPE.utility,
    color: LEGAL_COLORS.inkMuted,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  optionTextSelected: {
    color: LEGAL_COLORS.paperBg,
  },
});
