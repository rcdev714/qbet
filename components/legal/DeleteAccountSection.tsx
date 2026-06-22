import type { ComplianceJurisdiction } from "@/lib/compliance/jurisdiction";
import { DEFAULT_JURISDICTION } from "@/lib/compliance/jurisdiction";
import { getPolicyDocuments, POLICY_ROUTE_ORDER, policyRouteWithJurisdiction } from "@/lib/legal/policy-content";
import { authService } from "@/services/auth.service";
import { complianceService } from "@/services/compliance.service";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    type ViewStyle,
} from "react-native";

type DeleteAccountSectionProps = {
  theme: {
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    primary: string;
  };
  style?: ViewStyle;
  onDeleted?: () => void;
};

export function DeleteAccountSection({ theme, style, onDeleted }: DeleteAccountSectionProps) {
  const router = useRouter();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [jurisdiction, setJurisdiction] = useState<ComplianceJurisdiction>(DEFAULT_JURISDICTION);

  useEffect(() => {
    complianceService.getUserResidence().then((residence) => {
      if (residence?.jurisdiction) {
        setJurisdiction(residence.jurisdiction);
      }
    });
  }, []);

  const documents = getPolicyDocuments(jurisdiction);

  const startDelete = async () => {
    const { allowed, message, error } = await authService.checkCanDeleteAccount();
    if (error) {
      Alert.alert("Could not verify account", error.message);
      return;
    }
    if (!allowed) {
      Alert.alert("Account deletion blocked", message ?? "Your account cannot be deleted right now.");
      return;
    }
    setConfirmText("");
    setConfirmVisible(true);
  };

  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== "DELETE") {
      Alert.alert("Confirmation required", 'Type "DELETE" to confirm account deletion.');
      return;
    }

    setDeleting(true);
    try {
      const { error, message } = await authService.deleteAccount();
      if (error) {
        Alert.alert("Could not delete account", message ?? error.message);
        return;
      }
      setConfirmVisible(false);
      onDeleted?.();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View style={style}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Privacy & Data</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => router.push(policyRouteWithJurisdiction(documents.privacy.route, jurisdiction) as any)}
          style={[styles.linkRow, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
        >
          <Text style={[styles.linkText, { color: theme.text }]}>Privacy Policy</Text>
          <Text style={{ color: theme.textSecondary }}>→</Text>
        </TouchableOpacity>

        {POLICY_ROUTE_ORDER.filter((kind) => kind !== "privacy").map((kind) => {
          const doc = documents[kind];
          return (
            <TouchableOpacity
              key={kind}
              onPress={() => router.push(policyRouteWithJurisdiction(doc.route, jurisdiction) as any)}
              style={[styles.linkRow, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
            >
              <Text style={[styles.linkText, { color: theme.text }]}>{doc.title}</Text>
              <Text style={{ color: theme.textSecondary }}>→</Text>
            </TouchableOpacity>
          );
        })}

        <Text style={[styles.helperText, { color: theme.textSecondary }]}>
          Deleting your account removes login access and personal profile information. Some anonymized
          records may be retained for fraud prevention and legal compliance.
        </Text>

        {!confirmVisible ? (
          <TouchableOpacity
            onPress={startDelete}
            style={[
              styles.deleteButton,
              { borderColor: theme.error, backgroundColor: theme.surface },
              Platform.OS === "web" && ({ cursor: "pointer" } as any),
            ]}
          >
            <Text style={[styles.deleteButtonText, { color: theme.error }]}>Delete Account</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.confirmBlock}>
            <Text style={[styles.confirmLabel, { color: theme.text }]}>
              Type DELETE to permanently remove your account.
            </Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              placeholder="DELETE"
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.confirmInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
                Platform.OS === "web" && ({ cursor: "text" } as any),
              ]}
            />
            <View style={styles.confirmActions}>
              <TouchableOpacity
                onPress={() => setConfirmVisible(false)}
                style={[styles.cancelButton, Platform.OS === "web" && ({ cursor: "pointer" } as any)]}
                disabled={deleting}
              >
                <Text style={{ color: theme.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                style={[
                  styles.confirmDeleteButton,
                  { backgroundColor: theme.error },
                  Platform.OS === "web" && ({ cursor: "pointer" } as any),
                ]}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Delete permanently</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: "hidden",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  linkText: {
    fontSize: 16,
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  deleteButton: {
    margin: 16,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  confirmBlock: {
    padding: 16,
    gap: 10,
  },
  confirmLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  confirmInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    alignItems: "center",
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  confirmDeleteButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 150,
    alignItems: "center",
  },
  confirmDeleteText: {
    color: "#fff",
    fontWeight: "600",
  },
});
