import { AppButton, AppInput, AppText } from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useTheme } from "@/contexts/ThemeContext";
import {
  CREATE_GROUP_STEPS,
  canContinueCreateStep,
  createStepIndex,
  previousCreateStep,
  type CreateGroupStep,
  type GroupPrivacyChoice,
} from "@/lib/social/group-join";
import { groupService, type GroupAvatarUpload } from "@/services/group.service";
import type { GroupSummary } from "@/types/group";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";

import { GroupFlowSheet } from "./GroupFlowSheet";

interface CreateGroupSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (group: GroupSummary) => void;
}

const NAME_MAX = 48;
const BLURB_MAX = 160;

export function CreateGroupSheet({ visible, onClose, onCreated }: CreateGroupSheetProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("groups");
  const [step, setStep] = useState<CreateGroupStep>("name");
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [privacy, setPrivacy] = useState<GroupPrivacyChoice | null>(null);
  const [avatar, setAvatar] = useState<GroupAvatarUpload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<GroupSummary | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep("name");
    setName("");
    setBlurb("");
    setPrivacy(null);
    setAvatar(null);
    setSubmitting(false);
    setError(null);
    setCreated(null);
  }, [visible]);

  const stepNumber = createStepIndex(step) + 1;
  const canContinue = canContinueCreateStep(step, { name, privacy });

  const pickPhoto = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      const asset = result.canceled ? null : result.assets?.[0];
      if (!asset) return;
      if (!asset.base64) {
        setError(t("createPhotoFailed"));
        return;
      }
      setAvatar({
        base64: asset.base64,
        mimeType: asset.mimeType ?? null,
        uri: asset.uri,
      });
    } catch {
      setError(t("createPhotoFailed"));
    }
  };

  const goNext = () => {
    if (!canContinue || created) return;
    const index = createStepIndex(step);
    const next = CREATE_GROUP_STEPS[index + 1];
    if (next) setStep(next);
  };

  const submit = async () => {
    if (!privacy || !name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await groupService.createSocialGroup({
      name: name.trim(),
      description: blurb.trim() || undefined,
      privacy,
      avatar,
    });
    setSubmitting(false);
    if (result.error || !result.group) {
      setError(t("createFailed"));
      return;
    }
    if (result.privacyError || result.avatarError) {
      setCreated(result.group);
      setError(result.privacyError ? t("createPrivacyFailed") : t("createAvatarFailed"));
      return;
    }
    onCreated(result.group);
  };

  const footer =
    created ? (
      <AppButton title={t("createContinueAnyway")} onPress={() => onCreated(created)} />
    ) : step === "about" ? (
      <AppButton title={t("createSubmit")} loading={submitting} disabled={!name.trim() || !privacy} onPress={submit} />
    ) : (
      <AppButton title={t("createContinue")} disabled={!canContinue} onPress={goNext} />
    );

  return (
    <GroupFlowSheet
      visible={visible}
      title={t("createSheetTitle")}
      closeLabel={t("createClose")}
      onClose={onClose}
      onBack={step === "name" || created ? undefined : () => {
        const previous = previousCreateStep(step);
        if (previous) setStep(previous);
      }}
      backLabel={t("createBack")}
      footer={footer}
    >
      <View
        accessibilityLabel={t("createStepA11y", { step: stepNumber, total: CREATE_GROUP_STEPS.length })}
        style={styles.dots}
      >
        {CREATE_GROUP_STEPS.map((item, index) => (
          <View
            key={item}
            style={[
              styles.dot,
              {
                width: index === stepNumber - 1 ? 22 : 8,
                backgroundColor: index <= stepNumber - 1 ? theme.primary : theme.border,
              },
            ]}
          />
        ))}
      </View>

      {step === "name" ? (
        <View style={styles.step}>
          <AppText variant="title2">{t("createNameTitle")}</AppText>
          <AppText variant="bodySm" color="secondary">{t("createNameHint")}</AppText>
          <AppInput
            value={name}
            onChangeText={setName}
            placeholder={t("createNamePlaceholder")}
            autoFocus
            maxLength={NAME_MAX}
            accessibilityLabel={t("createNameTitle")}
          />
        </View>
      ) : null}

      {step === "photo" ? (
        <View style={styles.step}>
          <AppText variant="title2">{t("createPhotoTitle")}</AppText>
          <AppText variant="bodySm" color="secondary">{t("createPhotoHint")}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={avatar ? t("createChangePhoto") : t("createAddPhoto")}
            onPress={pickPhoto}
            style={[styles.photoButton, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            {avatar ? (
              <Image
                source={{ uri: avatar.uri }}
                style={styles.photo}
                contentFit="cover"
                accessibilityLabel={t("createPhotoA11y")}
              />
            ) : (
              <IconSymbol name="photo.fill" size={28} color={theme.primary} />
            )}
          </Pressable>
          <AppButton
            title={avatar ? t("createChangePhoto") : t("createAddPhoto")}
            variant="secondary"
            onPress={pickPhoto}
          />
        </View>
      ) : null}

      {step === "privacy" ? (
        <View style={styles.step}>
          <AppText variant="title2">{t("createPrivacyTitle")}</AppText>
          <View accessibilityRole="radiogroup" style={styles.choices}>
            <PrivacyChoice
              title={t("createPrivacyProfile")}
              hint={t("createPrivacyProfileHint")}
              selected={privacy === "profile"}
              onPress={() => setPrivacy("profile")}
            />
            <PrivacyChoice
              title={t("createPrivacyInvite")}
              hint={t("createPrivacyInviteHint")}
              selected={privacy === "invite"}
              onPress={() => setPrivacy("invite")}
            />
          </View>
        </View>
      ) : null}

      {step === "about" ? (
        <View style={styles.step}>
          <AppText variant="title2">{t("createAboutTitle")}</AppText>
          <AppText variant="bodySm" color="secondary">{t("createAboutHint")}</AppText>
          <AppInput
            value={blurb}
            onChangeText={setBlurb}
            placeholder={t("createAboutPlaceholder")}
            multiline
            maxLength={BLURB_MAX}
            style={styles.blurb}
            accessibilityLabel={t("createAboutTitle")}
          />
        </View>
      ) : null}

      {error ? (
        <AppText variant="bodySm" color="destructive">{error}</AppText>
      ) : null}
    </GroupFlowSheet>
  );
}

function PrivacyChoice({
  title,
  hint,
  selected,
  onPress,
}: {
  title: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      style={[
        styles.choice,
        {
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? `${theme.primary}14` : theme.surface,
        },
      ]}
    >
      <AppText variant="body">{title}</AppText>
      <AppText variant="bodySm" color="secondary">{hint}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  step: {
    gap: 12,
  },
  photoButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: {
    width: 96,
    height: 96,
  },
  choices: {
    gap: 12,
  },
  choice: {
    minHeight: 72,
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
    justifyContent: "center",
  },
  blurb: {
    minHeight: 96,
    textAlignVertical: "top",
  },
});
