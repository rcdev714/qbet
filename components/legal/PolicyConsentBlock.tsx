import { Brand } from "@/constants/theme";
import type { ComplianceJurisdiction } from "@/lib/compliance/jurisdiction";
import {
    getPolicyDocuments,
    POLICY_ROUTE_ORDER,
    policyRouteWithJurisdiction,
} from "@/lib/legal/policy-content";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type PolicyConsentBlockProps = {
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  jurisdiction: ComplianceJurisdiction;
  countryCode?: string | null;
  variant?: "dark" | "light";
};

export function PolicyConsentBlock({
  accepted,
  onAcceptedChange,
  jurisdiction,
  countryCode,
  variant = "dark",
}: PolicyConsentBlockProps) {
  const router = useRouter();
  const { t } = useTranslation("compliance");
  const isDark = variant === "dark";
  const documents = getPolicyDocuments(jurisdiction, countryCode);
  const jurisdictionLabel = jurisdiction === "EC" ? t("frameworkEc") : t("frameworkUs");

  const openPolicy = (route: string) => {
    router.push(policyRouteWithJurisdiction(route, jurisdiction) as any);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, isDark ? styles.labelDark : styles.labelLight]}>
        {t("relatedPolicies")}
      </Text>

      <View style={[styles.policyList, isDark ? styles.policyListDark : styles.policyListLight]}>
        {POLICY_ROUTE_ORDER.map((kind) => {
          const doc = documents[kind];
          return (
            <TouchableOpacity
              key={kind}
              onPress={() => openPolicy(doc.route)}
              style={[styles.policyLink, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
              activeOpacity={0.75}
            >
              <Text style={[styles.policyLinkText, isDark ? styles.linkDark : styles.linkLight]}>
                {doc.title}
              </Text>
              <Ionicons
                name="open-outline"
                size={14}
                color={isDark ? Brand.onPrimary : Brand.mutedText}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.agreementRow, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
        onPress={() => onAcceptedChange(!accepted)}
        activeOpacity={0.75}
      >
        <View
          style={[
            styles.checkbox,
            isDark ? styles.checkboxDark : styles.checkboxLight,
            accepted && styles.checkboxChecked,
          ]}
        >
          {accepted && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Text style={[styles.label, isDark ? styles.labelDark : styles.labelLight]}>
          {t("consentCheckbox", { jurisdiction: jurisdictionLabel })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  policyList: {
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  policyListDark: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  policyListLight: {
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  policyLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  policyLinkText: {
    fontSize: 14,
    flex: 1,
    fontWeight: "500",
  },
  linkDark: {
    color: "#F8FBFF",
    textDecorationLine: "underline",
  },
  linkLight: {
    color: Brand.primary,
    textDecorationLine: "underline",
  },
  agreementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.25,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxDark: {
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  checkboxLight: {
    borderColor: "rgba(15, 23, 42, 0.2)",
  },
  checkboxChecked: {
    backgroundColor: Brand.primary,
    borderColor: Brand.primary,
  },
  label: {
    fontSize: 13,
    lineHeight: 19,
    flexShrink: 1,
    textAlign: "left",
  },
  labelDark: {
    color: "rgba(228, 236, 250, 0.75)",
  },
  labelLight: {
    color: Brand.mutedText,
  },
});
