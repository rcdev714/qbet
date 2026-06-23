import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { CodeInput } from "@/components/ui/CodeInput";
import { Collapsible } from "@/components/ui/collapsible";
import { useGroups } from "@/hooks/useGroups";
import { showAppAlertRaw } from "@/lib/ui/feedback";

interface JoinGroupPanelProps {
  onJoined?: () => void;
  collapsible?: boolean;
}

export function JoinGroupPanel({ onJoined, collapsible = true }: JoinGroupPanelProps) {
  const { t } = useTranslation("social");
  const { joinGroup } = useGroups();
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (joinCode.length !== 6) return;

    setLoading(true);
    try {
      const { error } = await joinGroup(joinCode.toUpperCase());
      if (error) throw error;
      setJoinCode("");
      onJoined?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred";
      showAppAlertRaw(
        "Failed",
        message === "Group not found" ? "Invalid code. Please check and try again." : message,
      );
    } finally {
      setLoading(false);
    }
  };

  const panel = (
    <View style={styles.panel}>
      <AppText variant="bodySm" color="secondary" style={styles.helper}>
        {t("joinGroupHelper")}
      </AppText>
      <CodeInput value={joinCode} onChange={setJoinCode} length={6} />
      {joinCode.length === 6 ? (
        <AppButton title={t("joinGroup")} loading={loading} onPress={handleJoin} style={styles.button} />
      ) : null}
    </View>
  );

  if (!collapsible) return panel;

  return <Collapsible title={t("joinGroup")}>{panel}</Collapsible>;
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
    paddingTop: 4,
  },
  helper: {
    lineHeight: 20,
  },
  button: {
    alignSelf: "flex-start",
  },
});
