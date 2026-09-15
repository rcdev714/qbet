import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppButton, AppInput, AppText, FieldGroup } from "@/components/ui";
import { useTheme } from "@/contexts/ThemeContext";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import { validateEcuadorCedula } from "@/lib/wallet-payout.logic";
import type { PayoutDraft } from "@/services/wallet.service";
import { walletService } from "@/services/wallet.service";

import {
  WalletBankPicker,
  type WalletBankSelection,
} from "./WalletBankPicker";

export interface PayoutProfileFormValues {
  firstName: string;
  lastName: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  idNumber: string;
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  bankAccountNumber: string;
  bank: WalletBankSelection | null;
}

interface WalletPayoutProfileFormProps {
  userId: string;
  email: string;
  country: string;
  initialDraft?: PayoutDraft | null;
  defaultName?: string;
  onSuccess?: () => void;
  onNeedsStripeRedirect?: (url: string) => void;
}

function splitFullName(fullName?: string) {
  if (!fullName?.trim()) return { firstName: "", lastName: "" };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export function WalletPayoutProfileForm({
  userId,
  email,
  country,
  initialDraft,
  defaultName,
  onSuccess,
  onNeedsStripeRedirect,
}: WalletPayoutProfileFormProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("wallet");
  const isEcuador = country.toUpperCase() === "EC";
  const nameParts = useMemo(() => splitFullName(defaultName), [defaultName]);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState<PayoutProfileFormValues>(() => ({
    firstName: initialDraft?.firstName ?? nameParts.firstName,
    lastName: initialDraft?.lastName ?? nameParts.lastName,
    dobDay: "",
    dobMonth: "",
    dobYear: "",
    idNumber: "",
    addressLine1: initialDraft?.addressLine1 ?? "",
    city: initialDraft?.city ?? "",
    province: initialDraft?.province ?? "",
    postalCode: initialDraft?.postalCode ?? "",
    bankAccountNumber: "",
    bank: initialDraft?.bankCode
      ? {
          bankCode: initialDraft.bankCode,
          bankName: initialDraft.bankName ?? "",
          swift: initialDraft.swift ?? "",
        }
      : null,
  }));

  useEffect(() => {
    if (!initialDraft) return;
    setValues((prev) => ({
      ...prev,
      firstName: initialDraft.firstName ?? prev.firstName,
      lastName: initialDraft.lastName ?? prev.lastName,
      addressLine1: initialDraft.addressLine1 ?? prev.addressLine1,
      city: initialDraft.city ?? prev.city,
      province: initialDraft.province ?? prev.province,
      postalCode: initialDraft.postalCode ?? prev.postalCode,
      bank: initialDraft.bankCode
        ? {
            bankCode: initialDraft.bankCode,
            bankName: initialDraft.bankName ?? "",
            swift: initialDraft.swift ?? "",
          }
        : prev.bank,
    }));
  }, [initialDraft]);

  const setField = <K extends keyof PayoutProfileFormValues>(
    key: K,
    value: PayoutProfileFormValues[K],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!values.firstName.trim() || !values.lastName.trim()) {
      showAppAlertRaw(t("payoutFormTitle"), t("payoutFirstName"));
      return;
    }
    if (isEcuador && !validateEcuadorCedula(values.idNumber)) {
      showAppAlertRaw(t("payoutCedula"), "Enter a valid 10-digit cédula.");
      return;
    }
    if (!values.bank?.swift) {
      showAppAlertRaw(t("payoutBankLabel"), t("payoutBankSearch"));
      return;
    }
    if (!values.bankAccountNumber.trim()) {
      showAppAlertRaw(t("payoutAccountNumber"), t("payoutAccountNumber"));
      return;
    }

    setLoading(true);
    try {
      await walletService.savePayoutDraft({
        bank_code: values.bank.bankCode,
        bank_name: values.bank.bankName,
        swift: values.bank.swift,
        city: values.city,
        province: values.province,
        first_name: values.firstName,
        last_name: values.lastName,
        address_line1: values.addressLine1,
        postal_code: values.postalCode || undefined,
      });

      await walletService.ensureConnectAccount(userId, email, country);

      await walletService.submitVerificationDetails(userId, {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        dobDay: Number(values.dobDay),
        dobMonth: Number(values.dobMonth),
        dobYear: Number(values.dobYear),
        addressLine1: values.addressLine1.trim(),
        city: values.city.trim(),
        state: values.province.trim(),
        postalCode: values.postalCode.trim(),
        country,
        idNumber: values.idNumber.replace(/\D/g, ""),
        idType: isEcuador ? "cedula" : "ssn",
      });

      const setup = await walletService.submitPayoutSetup({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        dobDay: Number(values.dobDay),
        dobMonth: Number(values.dobMonth),
        dobYear: Number(values.dobYear),
        addressLine1: values.addressLine1.trim(),
        city: values.city.trim(),
        state: values.province.trim(),
        postalCode: values.postalCode.trim(),
        idNumber: values.idNumber.replace(/\D/g, ""),
        idType: isEcuador ? "national_id" : "ssn",
        bankAccountNumber: values.bankAccountNumber.trim(),
        swift: values.bank.swift,
      });

      setSubmitted(true);

      if (setup?.needsOnboarding && onNeedsStripeRedirect) {
        onNeedsStripeRedirect(setup.needsOnboarding);
        return;
      }

      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      testID="wallet-payout-form"
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <AppText variant="title3">{t("payoutFormTitle")}</AppText>
      <AppText variant="bodySm" color="secondary">
        {t("payoutFormBody")}
      </AppText>

      <FieldGroup>
        <AppText variant="caption" color="secondary" style={styles.section}>
          {t("payoutSectionPersonal")}
        </AppText>
        <View style={styles.row}>
          <View style={styles.half}>
            <AppInput
              testID="payout-first-name"
              label={t("payoutFirstName")}
              value={values.firstName}
              onChangeText={(text) => setField("firstName", text)}
            />
          </View>
          <View style={styles.half}>
            <AppInput
              label={t("payoutLastName")}
              value={values.lastName}
              onChangeText={(text) => setField("lastName", text)}
            />
          </View>
        </View>
        <AppText variant="caption" color="secondary">
          {t("payoutDobLabel")}
        </AppText>
        <View style={styles.row}>
          <View style={styles.third}>
            <AppInput
              label={t("payoutDobDay")}
              value={values.dobDay}
              onChangeText={(text) => setField("dobDay", text.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
              placeholder="DD"
            />
          </View>
          <View style={styles.third}>
            <AppInput
              label={t("payoutDobMonth")}
              value={values.dobMonth}
              onChangeText={(text) => setField("dobMonth", text.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
              placeholder="MM"
            />
          </View>
          <View style={styles.third}>
            <AppInput
              label={t("payoutDobYear")}
              value={values.dobYear}
              onChangeText={(text) => setField("dobYear", text.replace(/\D/g, "").slice(0, 4))}
              keyboardType="number-pad"
              placeholder="YYYY"
            />
          </View>
        </View>
        <AppInput
          label={isEcuador ? t("payoutCedula") : t("payoutIdNumber")}
          value={values.idNumber}
          onChangeText={(text) => setField("idNumber", text)}
          keyboardType={isEcuador ? "number-pad" : "default"}
          placeholder={isEcuador ? "1234567890" : undefined}
        />

        <AppText variant="caption" color="secondary" style={styles.section}>
          {t("payoutSectionAddress")}
        </AppText>
        <AppInput
          label={t("payoutAddress")}
          value={values.addressLine1}
          onChangeText={(text) => setField("addressLine1", text)}
        />
        <View style={styles.row}>
          <View style={styles.half}>
            <AppInput
              label={t("payoutCity")}
              value={values.city}
              onChangeText={(text) => setField("city", text)}
            />
          </View>
          <View style={styles.half}>
            <AppInput
              label={t("payoutProvince")}
              value={values.province}
              onChangeText={(text) => setField("province", text)}
            />
          </View>
        </View>
        <AppInput
          label={t("payoutPostal")}
          value={values.postalCode}
          onChangeText={(text) => setField("postalCode", text)}
        />

        {isEcuador ? (
          <>
            <AppText variant="caption" color="secondary" style={styles.section}>
              {t("payoutSectionBank")}
            </AppText>
            <WalletBankPicker
              value={values.bank}
              onChange={(bank) => setField("bank", bank)}
            />
            <AppInput
              testID="payout-account-number"
              label={t("payoutAccountNumber")}
              value={values.bankAccountNumber}
              onChangeText={(text) => setField("bankAccountNumber", text.replace(/\s/g, ""))}
              keyboardType="number-pad"
              secureTextEntry={submitted}
            />
          </>
        ) : null}
      </FieldGroup>

      <AppButton
        testID="payout-save-continue"
        title={t("payoutSaveContinue")}
        size="sm"
        loading={loading}
        onPress={() => void handleSubmit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  section: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  half: {
    flex: 1,
  },
  third: {
    flex: 1,
  },
});
