import type { ComplianceJurisdiction } from "@/lib/compliance/jurisdiction";
import {
    getPolicyDocuments,
    POLICY_ROUTE_ORDER,
    policyRouteWithJurisdiction,
} from "@/lib/legal/policy-content";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
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
  variant?: "dark" | "light";
};

export function PolicyConsentBlock({
  accepted,
  onAcceptedChange,
  jurisdiction,
  variant = "dark",
}: PolicyConsentBlockProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const isDark = variant === "dark";
  const documents = getPolicyDocuments(jurisdiction);

  const openPolicy = (route: string) => {
    router.push(policyRouteWithJurisdiction(route, jurisdiction) as any);
  };

  return (
    <View style={styles.container}>
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
          I have read and accept all required policies for the {jurisdiction} compliance framework.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={[styles.expandButton, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
      >
        <Text style={[styles.expandText, isDark ? styles.labelDark : styles.labelLight]}>
          {expanded ? "Hide policies" : "View all policies"}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={isDark ? "rgba(228, 236, 250, 0.75)" : "#526173"}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.policyList, isDark ? styles.policyListDark : styles.policyListLight]}>
          {POLICY_ROUTE_ORDER.map((kind) => {
            const doc = documents[kind];
            return (
              <TouchableOpacity
                key={kind}
                onPress={() => openPolicy(doc.route)}
                style={[styles.policyLink, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
              >
                <Text style={[styles.policyLinkText, isDark ? styles.linkDark : styles.linkLight]}>
                  {doc.title}
                </Text>
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={isDark ? "#F8FBFF" : BRAND_ACCENT}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const BRAND_ACCENT = "#2A5BFF";

const styles = StyleSheet.create({
  container: {
    gap: 8,
    marginTop: 4,
  },
  agreementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 2,
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
    backgroundColor: "#0090FF",
    borderColor: "#0090FF",
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
    color: "#526173",
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 30,
  },
  expandText: {
    fontSize: 12,
    fontWeight: "500",
  },
  policyList: {
    marginLeft: 30,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  policyListDark: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  policyListLight: {
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  policyLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 4,
  },
  policyLinkText: {
    fontSize: 13,
    flex: 1,
    textDecorationLine: "underline",
  },
  linkDark: {
    color: "#F8FBFF",
  },
  linkLight: {
    color: BRAND_ACCENT,
  },
});
