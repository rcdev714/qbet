import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { showAppAlertRaw } from "@/lib/ui/feedback";
import { groupService } from "@/services/group.service";

interface GroupJoinButtonProps {
  groupId: string;
  size?: "sm" | "md";
  onJoined?: () => void;
}

export function GroupJoinButton({ groupId, size = "md", onJoined }: GroupJoinButtonProps) {
  const { t } = useTranslation("social");
  const [loading, setLoading] = useState(false);
  const [joined, setJoined] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    const { error } = await groupService.joinGroupFromProfile(groupId);
    setLoading(false);

    if (error) {
      showAppAlertRaw(t("joinFailed"), error.message);
      return;
    }

    setJoined(true);
    onJoined?.();
  };

  if (joined) {
    return (
      <AppButton title={t("groupMember")} variant="secondary" size={size} disabled style={styles.btn} />
    );
  }

  return (
    <AppButton
      title={t("joinGroupShort")}
      variant="primary"
      size={size}
      loading={loading}
      onPress={handleJoin}
      style={styles.btn}
    />
  );
}

const styles = StyleSheet.create({
  btn: {
    minWidth: 72,
  },
});
