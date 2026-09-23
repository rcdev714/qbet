import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppText } from "@/components/ui/AppText";
import { Collapsible } from "@/components/ui/collapsible";
import { useGroupNavigation } from "@/hooks/useGroupNavigation";
import { useGroups } from "@/hooks/useGroups";

import { JoinGroupSheet } from "./JoinGroupSheet";

interface JoinGroupPanelProps {
  onJoined?: (groupId: string) => void;
  collapsible?: boolean;
}

export function JoinGroupPanel({ onJoined, collapsible = true }: JoinGroupPanelProps) {
  const { t } = useTranslation("social");
  const { t: tGroups } = useTranslation("groups");
  const { refresh } = useGroups();
  const { openGroup } = useGroupNavigation();
  const [open, setOpen] = useState(false);

  const finish = (groupId: string) => {
    setOpen(false);
    void refresh();
    onJoined?.(groupId);
    openGroup(groupId, { message: tGroups("opening") });
  };

  const panel = (
    <View style={styles.panel}>
      <AppText variant="bodySm" color="secondary" style={styles.helper}>
        {t("joinGroupHelper")}
      </AppText>
      <AppButton title={tGroups("joinEntry")} onPress={() => setOpen(true)} style={styles.button} />
      <JoinGroupSheet visible={open} onClose={() => setOpen(false)} onJoined={finish} />
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
