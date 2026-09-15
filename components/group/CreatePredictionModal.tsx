import { AppButton, AppIconButton, AppInput, AppText, ErrorBanner, FieldGroup } from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getTextStyle } from "@/constants/typography";
import { useTheme } from "@/contexts/ThemeContext";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import type { ImagePickerAsset } from "expo-image-picker";
import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

export interface CreatePredictionModalProps {
  visible: boolean;
  onClose: () => void;
  isFirstBetOnboarding: boolean;
  newQuestion: string;
  onQuestionChange: (text: string) => void;
  newOptions: string[];
  onUpdateOption: (text: string, index: number) => void;
  onRemoveOption: (index: number) => void;
  onAddOption: () => void;
  selectedInitialOption: number | null;
  onSelectInitialOption: (index: number) => void;
  closesAt: Date;
  onClosesAtChange: (date: Date) => void;
  showDatePicker: boolean;
  onShowDatePickerChange: (show: boolean) => void;
  initialBetAmount: string;
  onInitialBetAmountChange: (text: string) => void;
  marketImage: ImagePickerAsset | null;
  onPickMarketImage: () => void;
  createLoading: boolean;
  onCreate: () => void;
}

export function CreatePredictionModal({
  visible,
  onClose,
  isFirstBetOnboarding,
  newQuestion,
  onQuestionChange,
  newOptions,
  onUpdateOption,
  onRemoveOption,
  onAddOption,
  selectedInitialOption,
  onSelectInitialOption,
  closesAt,
  onClosesAtChange,
  showDatePicker,
  onShowDatePickerChange,
  initialBetAmount,
  onInitialBetAmountChange,
  marketImage,
  onPickMarketImage,
  createLoading,
  onCreate,
}: CreatePredictionModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
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
                maxHeight: "90%",
                backgroundColor: theme.surface,
                borderColor: theme.border,
                borderTopLeftRadius: theme.radius.xl,
                borderTopRightRadius: theme.radius.xl,
              },
            ]}
          >
            <View style={[styles.modalHeader, { padding: theme.spacing.lg }]}>
              <AppIconButton
                accessibilityLabel="Go back"
                variant="ghost"
                onPress={onClose}
                icon={<AppText variant="title2">←</AppText>}
              />
              <AppText variant="title2" style={styles.modalTitle}>
                Create Prediction
              </AppText>
              <AppIconButton
                accessibilityLabel="Close"
                variant="ghost"
                onPress={onClose}
                icon={<IconSymbol name="xmark.circle.fill" size={28} color={theme.textSecondary} />}
              />
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: 60 }}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
            >
              <FieldGroup>
                {isFirstBetOnboarding ? (
                  <View
                    style={[
                      styles.firstBetGuideCard,
                      {
                        backgroundColor: theme.primarySoft,
                        borderColor: theme.primary,
                        borderRadius: theme.radius.lg,
                      },
                    ]}
                  >
                    <View style={styles.firstBetGuideHeader}>
                      <View
                        style={[
                          styles.firstBetGuideIcon,
                          { backgroundColor: theme.primarySoft, borderRadius: theme.radius.pill },
                        ]}
                      >
                        <IconSymbol name="sparkles" size={18} color={theme.primary} />
                      </View>
                      <AppText variant="caption" color="primary">
                        STEP 2 OF 2
                      </AppText>
                    </View>
                    <AppText variant="title1">Create your first group bet</AppText>
                    <AppText variant="bodySm" color="secondary">
                      Ask a simple yes/no question, keep the starter outcomes, then launch it. We preselected a
                      small first bet when your balance allows it.
                    </AppText>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={onPickMarketImage}
                  style={[
                    styles.imagePickerButton,
                    {
                      backgroundColor: theme.input,
                      borderColor: theme.border,
                      borderRadius: theme.radius.xl,
                    },
                  ]}
                >
                  {marketImage ? (
                    <Image
                      source={{ uri: marketImage.uri }}
                      style={[styles.selectedImage, { borderRadius: theme.radius.xl }]}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.imagePickerPlaceholder}>
                      <IconSymbol name="photo.fill" size={32} color={theme.primary} />
                      <AppText variant="body" color="primary" style={{ marginTop: theme.spacing.sm }}>
                        Add Cover Image
                      </AppText>
                    </View>
                  )}
                </TouchableOpacity>

                <AppInput
                  label="What are you predicting?"
                  placeholder="e.g. Will bitcoin hit $100k by 2026?"
                  value={newQuestion}
                  onChangeText={onQuestionChange}
                  multiline
                  style={{ minHeight: 60, textAlignVertical: "top" }}
                />

                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="label" color="secondary">
                    Available Outcomes
                  </AppText>
                  {newOptions.map((item, index) => (
                    <View
                      key={index}
                      style={[
                        styles.optionInputRow,
                        {
                          backgroundColor: theme.input,
                          borderColor: selectedInitialOption === index ? theme.primary : "transparent",
                          borderRadius: theme.radius.md,
                          padding: theme.spacing.sm,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.optionCheck,
                          {
                            borderColor: theme.border,
                            borderRadius: theme.radius.md,
                            backgroundColor:
                              selectedInitialOption === index ? theme.primary : "transparent",
                          },
                          selectedInitialOption === index && { borderColor: theme.primary },
                        ]}
                        onPress={() => onSelectInitialOption(index)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: selectedInitialOption === index }}
                      >
                        {selectedInitialOption === index ? (
                          <IconSymbol name="checkmark" size={14} color={theme.onPrimary} />
                        ) : null}
                      </TouchableOpacity>
                      <AppInput
                        placeholder={`Outcome ${index + 1}`}
                        value={item}
                        onChangeText={(text) => onUpdateOption(text, index)}
                        style={{ flex: 1, marginLeft: theme.spacing.sm, borderWidth: 0, backgroundColor: "transparent" }}
                      />
                      {newOptions.length > 2 ? (
                        <AppIconButton
                          accessibilityLabel={`Remove outcome ${index + 1}`}
                          variant="ghost"
                          onPress={() => onRemoveOption(index)}
                          icon={<IconSymbol name="minus.circle.fill" size={20} color={theme.destructive} />}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>

                <AppButton
                  title="Add another outcome"
                  variant="ghost"
                  size="sm"
                  onPress={onAddOption}
                  icon={<IconSymbol name="plus.circle.fill" size={20} color={theme.primary} />}
                  style={{
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: theme.primary,
                  }}
                />

                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="label" color="secondary">
                    Closing Date
                  </AppText>
                  {Platform.OS === "web" ? (
                    <View
                      style={[
                        styles.dateButton,
                        {
                          backgroundColor: theme.input,
                          borderColor: theme.border,
                          borderRadius: theme.radius.lg,
                          padding: theme.spacing.sm,
                        },
                      ]}
                    >
                      {React.createElement("input", {
                        type: "datetime-local",
                        value: new Date(closesAt.getTime() - closesAt.getTimezoneOffset() * 60000)
                          .toISOString()
                          .slice(0, 16),
                        onChange: (event: { target: { value: string } }) => {
                          const date = new Date(event.target.value);
                          if (!Number.isNaN(date.getTime())) {
                            onClosesAtChange(date);
                          }
                        },
                        style: {
                          ...getTextStyle("body"),
                          color: theme.text,
                          height: "100%",
                          width: "100%",
                          backgroundColor: "transparent",
                          border: "none",
                          outline: "none",
                          fontFamily: "System",
                        },
                      })}
                    </View>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.dateButton,
                          {
                            backgroundColor: theme.input,
                            borderColor: theme.border,
                            borderRadius: theme.radius.lg,
                            padding: theme.spacing.md,
                          },
                        ]}
                        onPress={() => onShowDatePickerChange(true)}
                      >
                        <AppText variant="body">
                          {closesAt.toLocaleDateString()} at{" "}
                          {closesAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </AppText>
                        <IconSymbol name="calendar" size={20} color={theme.primary} />
                      </TouchableOpacity>
                      {showDatePicker ? (
                        <DateTimePicker
                          value={closesAt}
                          mode="datetime"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          onChange={(_event, date) => {
                            onShowDatePickerChange(Platform.OS === "ios");
                            if (date) onClosesAtChange(date);
                          }}
                          minimumDate={new Date()}
                          textColor={theme.text}
                        />
                      ) : null}
                    </>
                  )}
                </View>

                <View style={{ gap: theme.spacing.sm }}>
                  <AppText variant="label" color="secondary">
                    Initial Prediction Amount (Optional)
                  </AppText>
                  <View
                    style={[
                      styles.initialBetInputRow,
                      {
                        backgroundColor: theme.input,
                        borderRadius: theme.radius.lg,
                        padding: theme.spacing.md,
                        borderColor: theme.border,
                      },
                    ]}
                  >
                    <AppText variant="title3">$</AppText>
                    <AppInput
                      placeholder="0.00"
                      value={initialBetAmount}
                      onChangeText={onInitialBetAmountChange}
                      keyboardType="numeric"
                      style={{ flex: 1, marginLeft: theme.spacing.sm, borderWidth: 0, backgroundColor: "transparent" }}
                    />
                  </View>
                  {selectedInitialOption === null && initialBetAmount !== "" ? (
                    <ErrorBanner message="Select one above outcome to place this initial amount" />
                  ) : null}
                </View>

                <AppButton
                  title="Launch Now"
                  size="lg"
                  loading={createLoading}
                  disabled={createLoading}
                  onPress={onCreate}
                />
              </FieldGroup>
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalKeyboardAvoiding: { justifyContent: "flex-end" },
  modalContent: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { flex: 1, textAlign: "center" },
  firstBetGuideCard: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 8,
  },
  firstBetGuideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  firstBetGuideIcon: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  imagePickerButton: {
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    height: 160,
    borderWidth: 1,
  },
  selectedImage: { width: "100%", height: "100%" },
  imagePickerPlaceholder: { justifyContent: "center", alignItems: "center" },
  optionInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 10,
  },
  optionCheck: {
    borderWidth: 2,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  dateButton: {
    borderWidth: 1,
    height: 60,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  initialBetInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
});
