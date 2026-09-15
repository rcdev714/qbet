import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppText } from "@/components/ui/AppText";
import {
  ECUADOR_BANKS,
  ECUADOR_BANK_OTHER_CODE,
  type EcuadorBank,
} from "@/constants/ecuador-banks";
import { useTheme } from "@/contexts/ThemeContext";

export interface WalletBankSelection {
  bankCode: string;
  bankName: string;
  swift: string;
}

interface WalletBankPickerProps {
  value: WalletBankSelection | null;
  onChange: (selection: WalletBankSelection) => void;
}

export function WalletBankPicker({ value, onChange }: WalletBankPickerProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("wallet");
  const [query, setQuery] = useState("");
  const [customSwift, setCustomSwift] = useState(
    value?.bankCode === ECUADOR_BANK_OTHER_CODE ? value.swift : "",
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ECUADOR_BANKS;
    return ECUADOR_BANKS.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.swift.toLowerCase().includes(q),
    );
  }, [query]);

  const selectBank = (bank: EcuadorBank) => {
    onChange({ bankCode: bank.code, bankName: bank.name, swift: bank.swift });
  };

  const selectOther = () => {
    onChange({
      bankCode: ECUADOR_BANK_OTHER_CODE,
      bankName: t("payoutBankOther"),
      swift: customSwift.trim().toUpperCase(),
    });
  };

  return (
    <View testID="wallet-bank-picker" style={styles.container}>
      <AppText variant="caption" color="secondary" style={styles.label}>
        {t("payoutBankLabel")}
      </AppText>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t("payoutBankSearch")}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.search,
          {
            color: theme.text,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            borderRadius: theme.radius.md,
          },
        ]}
      />
      <View style={styles.list}>
        {filtered.map((bank) => {
          const selected = value?.bankCode === bank.code;
          return (
            <Pressable
              key={bank.code}
              accessibilityRole="button"
              onPress={() => selectBank(bank)}
              style={[
                styles.row,
                {
                  borderColor: selected ? theme.primary : theme.border,
                  backgroundColor: selected ? theme.primarySoft : theme.surface,
                  borderRadius: theme.radius.md,
                },
              ]}
            >
              <AppText variant="label">{bank.name}</AppText>
              <AppText variant="caption" color="secondary">
                {bank.swift}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={selectOther}
          style={[
            styles.row,
            {
              borderColor:
                value?.bankCode === ECUADOR_BANK_OTHER_CODE
                  ? theme.primary
                  : theme.border,
              backgroundColor:
                value?.bankCode === ECUADOR_BANK_OTHER_CODE
                  ? theme.primarySoft
                  : theme.surface,
              borderRadius: theme.radius.md,
            },
          ]}
        >
          <AppText variant="label">{t("payoutBankOther")}</AppText>
        </Pressable>
      </View>
      {value?.bankCode === ECUADOR_BANK_OTHER_CODE ? (
        <TextInput
          value={customSwift}
          onChangeText={(text) => {
            const next = text.toUpperCase();
            setCustomSwift(next);
            onChange({
              bankCode: ECUADOR_BANK_OTHER_CODE,
              bankName: t("payoutBankOther"),
              swift: next,
            });
          }}
          placeholder={t("payoutSwiftPlaceholder")}
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="characters"
          style={[
            styles.search,
            {
              color: theme.text,
              borderColor: theme.border,
              backgroundColor: theme.surface,
              borderRadius: theme.radius.md,
            },
          ]}
        />
      ) : null}
      {value?.swift ? (
        <AppText variant="caption" color="secondary">
          {t("payoutSwiftSelected", { swift: value.swift })}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  list: {
    gap: 8,
  },
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
});
