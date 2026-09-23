import { AppButton, AppText } from "@/components/ui";
import { CodeInput } from "@/components/ui/CodeInput";
import { useTheme } from "@/contexts/ThemeContext";
import {
  classifyJoinError,
  normalizeInviteCode,
  resolveJoinCard,
  type GroupCodePreview,
} from "@/lib/social/group-join";
import { groupService } from "@/services/group.service";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { GroupFlowSheet } from "./GroupFlowSheet";

interface JoinGroupSheetProps {
  visible: boolean;
  onClose: () => void;
  onJoined: (groupId: string) => void;
}

export function JoinGroupSheet({ visible, onClose, onJoined }: JoinGroupSheetProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("groups");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [missingRpc, setMissingRpc] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<GroupCodePreview | null>(null);
  const [joining, setJoining] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (visible) return;
    setCode("");
    setPending(false);
    setMissingRpc(false);
    setErrorMessage(null);
    setPreview(null);
    setJoining(false);
    setRetry(0);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const normalized = normalizeInviteCode(code);
    if (normalized.length !== 6) {
      setPending(false);
      setMissingRpc(false);
      setErrorMessage(null);
      setPreview(null);
      return;
    }

    let cancelled = false;
    setPending(true);
    const timer = setTimeout(() => {
      void groupService.previewGroupByCode(normalized).then((result) => {
        if (cancelled) return;
        setPending(false);
        setMissingRpc(result.missing);
        setErrorMessage(result.error?.message ?? null);
        setPreview(result.preview);
      });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, retry, visible]);

  const card = resolveJoinCard({ code, pending, missingRpc, errorMessage, preview });

  const join = async () => {
    if (card.kind === "already-in") {
      onJoined(card.preview.groupId);
      return;
    }
    if (card.kind !== "ready" && card.kind !== "preview-unavailable") return;
    setJoining(true);
    const { membership, error } = await groupService.joinGroupByCode(normalizeInviteCode(code));
    setJoining(false);
    if (error) {
      setErrorMessage(error.message);
      setPreview(null);
      setMissingRpc(false);
      return;
    }
    const groupId = membership?.group_id ?? (card.kind === "ready" ? card.preview.groupId : null);
    if (groupId) onJoined(groupId);
  };

  const primary =
    card.kind === "ready" || card.kind === "preview-unavailable" || card.kind === "already-in" ? (
      <AppButton
        title={card.kind === "already-in" ? t("joinOpen") : t("joinCta")}
        loading={joining}
        onPress={join}
      />
    ) : card.kind === "lookup-failed" ? (
      <AppButton title={t("joinRetry")} variant="secondary" onPress={() => setRetry((value) => value + 1)} />
    ) : null;

  return (
    <GroupFlowSheet
      visible={visible}
      title={t("joinSheetTitle")}
      closeLabel={t("createClose")}
      onClose={onClose}
      footer={primary}
    >
      <View style={styles.step}>
        <AppText variant="title2">{t("joinSheetTitle")}</AppText>
        <AppText variant="bodySm" color="secondary">{t("joinHint")}</AppText>
        <CodeInput
          value={code}
          onChange={setCode}
          length={6}
          autoFocus={visible}
          accessibilityLabel={t("joinCodeA11y")}
        />
      </View>

      {card.kind === "pending" ? (
        <View style={styles.status} accessibilityRole="progressbar" accessibilityLabel={t("joinPending")}>
          <ActivityIndicator color={theme.primary} />
          <AppText variant="bodySm" color="secondary">{t("joinPending")}</AppText>
        </View>
      ) : null}

      {card.kind === "invalid" ? (
        <AppText variant="bodySm" color="destructive">{t("joinInvalid")}</AppText>
      ) : null}

      {card.kind === "lookup-failed" ? (
        <AppText variant="bodySm" color="destructive">
          {classifyJoinError(errorMessage ?? "") === "invalid" ? t("joinInvalid") : t("joinLookupFailed")}
        </AppText>
      ) : null}

      {card.kind === "preview-unavailable" ? (
        <AppText variant="bodySm" color="secondary">{t("joinPreviewUnavailable")}</AppText>
      ) : null}

      {card.kind === "ready" || card.kind === "already-in" ? (
        <View
          accessibilityRole="summary"
          accessibilityLabel={t("joinPreviewA11y", { name: card.preview.name, count: card.preview.memberCount })}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <View style={[styles.avatar, { backgroundColor: `${theme.primary}18` }]}>
            {card.preview.avatarUrl ? (
              <Image source={{ uri: card.preview.avatarUrl }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <AppText variant="title3">{card.preview.name.slice(0, 1).toUpperCase()}</AppText>
            )}
          </View>
          <View style={styles.cardCopy}>
            <AppText variant="body">{card.preview.name}</AppText>
            {card.preview.description ? (
              <AppText variant="bodySm" color="secondary" numberOfLines={3}>
                {card.preview.description}
              </AppText>
            ) : null}
            <AppText variant="caption" color="secondary">
              {t("joinMembers", { count: card.preview.memberCount })}
              {" · "}
              {card.preview.isDiscoverable ? t("joinListed") : t("joinInviteOnly")}
            </AppText>
          </View>
        </View>
      ) : null}
    </GroupFlowSheet>
  );
}

const styles = StyleSheet.create({
  step: {
    gap: 12,
  },
  status: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 56,
    height: 56,
  },
  cardCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
});
