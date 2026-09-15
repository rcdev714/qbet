import { AppText } from "@/components/ui/AppText";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SUPPORT_EMAIL } from "@/lib/brand";
import { PLATFORM_INTEGRITY_NOTICE } from "@/lib/legal/platform-integrity-disclosure";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { useTheme } from "@/contexts/ThemeContext";

type GroupMemberHelpMenuProps = {
  groupId: string;
  adminId?: string;
  onReport?: () => void;
};

export function GroupMemberHelpMenu({ groupId, adminId, onReport }: GroupMemberHelpMenuProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const { t } = useTranslation("groupMember");
  const [open, setOpen] = useState(false);

  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Group support ${groupId}`)}`;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        accessibilityLabel={t("helpMenu")}
        style={Platform.OS === "web" ? ({ cursor: "pointer" } as object) : undefined}
      >
        <IconSymbol name="info.circle" size={22} color={theme.textSecondary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={[styles.overlay, { backgroundColor: theme.overlay }]} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <MenuRow label={t("settlementNoticeLink")} onPress={() => { setOpen(false); router.push("/group-settlements" as never); }} />
            <MenuRow label={PLATFORM_INTEGRITY_NOTICE.linkLabel} onPress={() => { setOpen(false); router.push("/platform-integrity" as never); }} />
            {onReport ? (
              <MenuRow label={t("reportAdmin")} onPress={() => { setOpen(false); onReport(); }} />
            ) : null}
            <MenuRow label={t("contactSupport")} onPress={() => { setOpen(false); void Linking.openURL(mailto); }} />
            <MenuRow label={t("urgentEscalation")} onPress={() => { setOpen(false); onReport?.(); }} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.row, Platform.OS === "web" ? ({ cursor: "pointer" } as object) : undefined]}
    >
      <AppText variant="bodySm">{label}</AppText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: 24 },
  menu: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { paddingHorizontal: 16, paddingVertical: 14, minHeight: 44, justifyContent: "center" },
});
