import { Brand } from "@/constants/theme";
import { countryCodeToFlag, FALLBACK_COUNTRIES } from "@/lib/compliance/countries";
import { complianceService, type SupportedCountryRow } from "@/services/compliance.service";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type CountryPickerProps = {
  selectedCountry?: string | null;
  onSelect: (country: SupportedCountryRow) => void;
  variant?: "light" | "dark";
  testID?: string;
};

export function CountryPicker({
  selectedCountry,
  onSelect,
  variant = "light",
  testID,
}: CountryPickerProps) {
  const [countries, setCountries] = useState<SupportedCountryRow[]>(FALLBACK_COUNTRIES);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const isDark = variant === "dark";

  useEffect(() => {
    let mounted = true;
    complianceService
      .getSupportedCountries()
      .then((rows: SupportedCountryRow[]) => {
        if (mounted && rows.length > 0) {
          setCountries(rows);
        }
      })
      .catch(() => {
        // keep fallback list
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.country_code.toLowerCase().includes(q) ||
        c.dial_code.includes(q),
    );
  }, [countries, query]);

  return (
    <View style={styles.container} testID={testID}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search country"
        placeholderTextColor={isDark ? "rgba(228,236,250,0.55)" : "#94A3B8"}
        style={[
          styles.search,
          isDark ? styles.searchDark : styles.searchLight,
          Platform.OS === "web" && ({ cursor: "text" } as any),
        ]}
      />

      {loading ? (
        <ActivityIndicator style={{ marginVertical: 16 }} color={Brand.primary} />
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {filtered.map((country) => {
            const selected = selectedCountry === country.country_code;
            return (
              <TouchableOpacity
                key={country.country_code}
                testID={`country-option-${country.country_code}`}
                onPress={() => onSelect(country)}
                style={[
                  styles.row,
                  selected && styles.rowSelected,
                  isDark ? styles.rowDark : styles.rowLight,
                  Platform.OS === "web" && ({ cursor: "pointer" } as any),
                ]}
              >
                <Text style={styles.flag}>{countryCodeToFlag(country.country_code)}</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.name, isDark ? styles.textDark : styles.textLight]}>
                    {country.name}
                  </Text>
                  <Text style={[styles.meta, isDark ? styles.metaDark : styles.metaLight]}>
                    {country.dial_code} · {country.default_jurisdiction} framework
                  </Text>
                </View>
                {selected ? <Text style={styles.check}>✓</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  search: {
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchLight: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(15, 23, 42, 0.12)",
    color: Brand.deep,
  },
  searchDark: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.2)",
    color: "#F8FBFF",
  },
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 6,
  },
  rowLight: {
    backgroundColor: "rgba(15, 23, 42, 0.03)",
  },
  rowDark: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  rowSelected: {
    borderWidth: 1,
    borderColor: Brand.primary,
  },
  flag: {
    fontSize: 22,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "500",
  },
  textLight: {
    color: Brand.deep,
  },
  textDark: {
    color: "#F8FBFF",
  },
  meta: {
    fontSize: 12,
  },
  metaLight: {
    color: "#64748B",
  },
  metaDark: {
    color: "rgba(228,236,250,0.65)",
  },
  check: {
    color: Brand.primary,
    fontSize: 16,
    fontWeight: "700",
  },
});
