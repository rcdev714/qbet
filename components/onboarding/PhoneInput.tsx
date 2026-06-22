import type { SupportedCountryRow } from "@/services/compliance.service";
import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";

type PhoneInputProps = {
  country: SupportedCountryRow | null;
  value: string;
  onChange: (value: string, e164: string | null) => void;
  variant?: "light" | "dark";
};

export function PhoneInput({ country, value, onChange, variant = "light" }: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const isDark = variant === "dark";

  useEffect(() => {
    setDisplayValue(value);
  }, [value, country?.country_code]);

  const handleChange = (text: string) => {
    if (!country) return;
    const formatter = new AsYouType(country.country_code as any);
    const formatted = formatter.input(text);
    setDisplayValue(formatted);

    const parsed = parsePhoneNumberFromString(formatted, country.country_code as any);
    onChange(formatted, parsed?.isValid() ? parsed.number : null);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isDark ? styles.labelDark : styles.labelLight]}>
        Phone number (optional)
      </Text>
      <View
        style={[
          styles.inputRow,
          isDark ? styles.inputRowDark : styles.inputRowLight,
          !country && styles.inputDisabled,
        ]}
      >
        <Text style={[styles.prefix, isDark ? styles.textDark : styles.textLight]}>
          {country?.dial_code ?? "+…"}
        </Text>
        <TextInput
          value={displayValue}
          onChangeText={handleChange}
          editable={Boolean(country)}
          keyboardType="phone-pad"
          placeholder={country ? "Mobile number" : "Select a country first"}
          placeholderTextColor={isDark ? "rgba(228,236,250,0.55)" : "#94A3B8"}
          style={[
            styles.input,
            isDark ? styles.textDark : styles.textLight,
            Platform.OS === "web" && ({ cursor: "text" } as any),
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  labelLight: {
    color: "#526173",
  },
  labelDark: {
    color: "rgba(228,236,250,0.75)",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    minHeight: 48,
    gap: 8,
  },
  inputRowLight: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(15, 23, 42, 0.12)",
  },
  inputRowDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  inputDisabled: {
    opacity: 0.6,
  },
  prefix: {
    fontSize: 15,
    fontWeight: "600",
    minWidth: 44,
  },
  textLight: {
    color: "#1A2F5C",
  },
  textDark: {
    color: "#F8FBFF",
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
  },
});
