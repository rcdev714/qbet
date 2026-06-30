import { PhoneInput } from "@/components/onboarding/PhoneInput";
import { getJurisdictionLabel } from "@/lib/compliance/jurisdiction";
import type { SupportedCountryRow, UserResidence } from "@/services/compliance.service";
import { complianceService } from "@/services/compliance.service";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    type ViewStyle,
} from "react-native";

type ResidenceSettingsSectionProps = {
  theme: {
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
  };
  style?: ViewStyle;
};

export function ResidenceSettingsSection({ theme, style }: ResidenceSettingsSectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [residence, setResidence] = useState<UserResidence | null>(null);
  const [countryRow, setCountryRow] = useState<SupportedCountryRow | null>(null);
  const [phoneDisplay, setPhoneDisplay] = useState("");
  const [phoneE164, setPhoneE164] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await complianceService.getUserResidence();
        if (!mounted || !data) return;
        setResidence(data);
        setPhoneDisplay(data.phone_e164?.replace(/^\+\d+\s?/, "") ?? "");
        setPhoneE164(data.phone_e164);

        if (data.country_of_residence) {
          const countries = await complianceService.getSupportedCountries();
          const row = countries.find((c) => c.country_code === data.country_of_residence) ?? null;
          if (mounted) setCountryRow(row);
        }
      } catch (error) {
        console.warn("[ResidenceSettings] Failed to load residence:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const phoneDirty = useMemo(() => {
    const stored = residence?.phone_e164 ?? null;
    return phoneE164 !== stored;
  }, [phoneE164, residence?.phone_e164]);

  const handleSavePhone = async () => {
    setSaving(true);
    try {
      await complianceService.updateUserPhone(phoneE164);
      setResidence((prev) => (prev ? { ...prev, phone_e164: phoneE164 } : prev));
      Alert.alert("Saved", "Phone number updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update phone number.";
      Alert.alert("Update failed", message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[style, styles.loadingRow]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!residence?.country_of_residence) {
    return null;
  }

  return (
    <View style={style}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Residence & Compliance</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Country</Text>
          <Text style={[styles.value, { color: theme.text }]}>
            {residence.country_name ?? residence.country_of_residence}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Framework</Text>
          <Text style={[styles.value, { color: theme.text }]}>
            {getJurisdictionLabel(residence.jurisdiction)}
          </Text>
        </View>
        <Text style={[styles.helper, { color: theme.textSecondary }]}>
          Country of residence is set during onboarding and tied to your payment profile. Contact
          support@anymarkt.com to request a change.
        </Text>

        <View style={styles.phoneBlock}>
          <PhoneInput
            country={countryRow}
            value={phoneDisplay}
            onChange={(display, e164) => {
              setPhoneDisplay(display);
              setPhoneE164(e164);
            }}
            variant="light"
          />
          {phoneDirty ? (
            <TouchableOpacity
              onPress={handleSavePhone}
              disabled={saving}
              style={[
                styles.savePhoneButton,
                { backgroundColor: theme.primary },
                Platform.OS === "web" && ({ cursor: "pointer" } as any),
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.savePhoneText}>Save phone</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    paddingVertical: 24,
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '400',
    textTransform: "uppercase",
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  value: {
    flex: 1,
    textAlign: "right",
    fontSize: 14,
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  helper: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  phoneBlock: {
    marginTop: 8,
    gap: 10,
  },
  savePhoneButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: "center",
  },
  savePhoneText: {
    color: "#fff",
    fontWeight: '400',
    fontSize: 14,
  },
});
