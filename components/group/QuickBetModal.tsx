import { AppButton, AppInput, AppText } from "@/components/ui";
import { ModalHeader } from "@/components/ui/ModalHeader";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCurrency } from "@/lib/parimutuel";
import type { Market } from "@/types/market";
import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

export interface QuickBetModalProps {
  visible: boolean;
  onClose: () => void;
  selectedMarket: Market | null;
  selectedSide: "yes" | "no" | null;
  balance: number;
  betAmount: string;
  onBetAmountChange: (text: string) => void;
  isPlacingBet: boolean;
  onPlaceBet: () => void;
}

export function QuickBetModal({
  visible,
  onClose,
  selectedMarket,
  selectedSide,
  balance,
  betAmount,
  onBetAmountChange,
  isPlacingBet,
  onPlaceBet,
}: QuickBetModalProps) {
  const { theme } = useTheme();
  const amount = parseFloat(betAmount);
  const showPayout = !Number.isNaN(amount) && amount > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: theme.overlay }]} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalKeyboardAvoiding}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderTopLeftRadius: theme.radius.xl,
                borderTopRightRadius: theme.radius.xl,
                minHeight: 200,
              },
            ]}
          >
            <ModalHeader title="Place Bet" onClose={onClose} closeLabel="Close" />

            {selectedMarket ? (
              <View
                style={[
                  styles.betContext,
                  {
                    backgroundColor: theme.input,
                    borderRadius: theme.radius.md,
                    margin: theme.spacing.lg,
                    marginBottom: theme.spacing.sm,
                  },
                ]}
              >
                <AppText variant="title2">{selectedMarket.question}</AppText>
                <View style={styles.betMeta}>
                  <AppText variant="bodySm" color="secondary">
                    Balance: {formatCurrency(balance)}
                  </AppText>
                  <AppText
                    variant="bodySm"
                    style={{ color: selectedSide === "yes" ? theme.primary : theme.marketNo }}
                  >
                    Predicting: {selectedSide?.toUpperCase()}
                  </AppText>
                </View>
              </View>
            ) : null}

            <View style={[styles.quickAmounts, { marginHorizontal: theme.spacing.lg }]}>
              {[10, 25, 50, 100].map((amt) => (
                <AppButton
                  key={amt}
                  title={`$${amt}`}
                  variant="secondary"
                  size="sm"
                  onPress={() => onBetAmountChange(amt.toString())}
                  style={{ flex: 1 }}
                />
              ))}
            </View>

            <View
              style={[
                styles.betInputWrapper,
                {
                  backgroundColor: theme.input,
                  borderColor: theme.border,
                  borderRadius: theme.radius.md,
                  marginHorizontal: theme.spacing.lg,
                },
              ]}
            >
              <AppText variant="title3">$</AppText>
              <AppInput
                testID="bet-amount"
                placeholder="0.00"
                value={betAmount}
                onChangeText={onBetAmountChange}
                keyboardType="numeric"
                autoFocus
                style={{ flex: 1, marginLeft: theme.spacing.sm, borderWidth: 0, backgroundColor: "transparent" }}
              />
            </View>

            {showPayout ? (
              <View
                style={[
                  styles.payoutPreview,
                  {
                    marginHorizontal: theme.spacing.lg,
                    borderRadius: theme.radius.md,
                    backgroundColor: theme.primarySoft,
                  },
                ]}
              >
                <AppText variant="bodySm" color="secondary">
                  Potential Payout
                </AppText>
                <AppText variant="title3" color="primary">
                  {formatCurrency(amount * 1.85)}
                </AppText>
              </View>
            ) : null}

            <AppButton
              testID="bet-place"
              title="Confirm Prediction"
              size="lg"
              loading={isPlacingBet}
              disabled={isPlacingBet || !betAmount}
              onPress={onPlaceBet}
              style={{ margin: theme.spacing.lg }}
            />
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalKeyboardAvoiding: { justifyContent: "flex-end" },
  modalContent: { borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  betContext: { padding: 20 },
  betMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  quickAmounts: { flexDirection: "row", gap: 8, marginBottom: 16 },
  betInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 16,
    marginVertical: 20,
  },
  payoutPreview: {
    marginBottom: 16,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
