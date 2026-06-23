import { UserAvatar } from "@/components/social/UserAvatar";
import { AppText } from "@/components/ui/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCurrency } from "@/lib/parimutuel";
import { mentionService } from "@/services/mention.service";
import type {
    MentionBetResult,
    MentionEmbedPayload,
    MentionGroupResult,
    MentionUserResult,
} from "@/types/mention";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    View
} from "react-native";

export type MentionContext = {
  groupId?: string;
  marketId?: string;
};

type MentionPickerProps = {
  visible: boolean;
  query: string;
  context: MentionContext;
  onSelect: (payload: MentionEmbedPayload) => void;
  onClose: () => void;
};

type MentionSection = "people" | "groups" | "bets";

export function MentionPicker({
  visible,
  query,
  context,
  onSelect,
  onClose,
}: MentionPickerProps) {
  const { theme } = useTheme();
  const { t } = useTranslation("groups");
  const [section, setSection] = useState<MentionSection>("people");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<MentionUserResult[]>([]);
  const [groups, setGroups] = useState<MentionGroupResult[]>([]);
  const [bets, setBets] = useState<MentionBetResult[]>([]);

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [userRows, groupRows, betRows] = await Promise.all([
          mentionService.searchMentionUsers(query, context.groupId ?? null),
          mentionService.searchMentionGroups(query),
          mentionService.searchMentionBets(query, {
            groupId: context.groupId ?? null,
            marketId: context.marketId ?? null,
          }),
        ]);
        setUsers(userRows);
        setGroups(groupRows);
        setBets(betRows);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [visible, query, context.groupId, context.marketId]);

  if (!visible) return null;

  const sections: { key: MentionSection; label: string }[] = [
    { key: "people", label: t("mentionSectionPeople") },
    { key: "groups", label: t("mentionSectionGroups") },
    { key: "bets", label: t("mentionSectionBets") },
  ];

  const renderPeople = () =>
    users.map((item) => (
      <Pressable
        key={item.user_id}
        style={[styles.row, { borderBottomColor: theme.borderSubtle }]}
        onPress={() => {
          onSelect({ type: "profile", userId: item.user_id });
          onClose();
        }}
      >
        <UserAvatar uri={item.avatar_url} username={item.username} size={36} />
        <View style={styles.rowText}>
          <AppText variant="body">@{item.username}</AppText>
          {item.is_group_member ? (
            <AppText variant="caption" color="secondary">
              {t("mentionGroupMember")}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    ));

  const renderGroups = () =>
    groups.map((item) => (
      <Pressable
        key={item.group_id}
        style={[styles.row, { borderBottomColor: theme.borderSubtle }]}
        onPress={() => {
          onSelect({ type: "group", groupId: item.group_id });
          onClose();
        }}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.groupAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.groupAvatar, { backgroundColor: theme.primarySoft }]} />
        )}
        <View style={styles.rowText}>
          <AppText variant="body">{item.name ?? t("mentionGroupFallback")}</AppText>
          <AppText variant="caption" color="secondary">
            {t("mentionGroupMembers", { count: item.member_count })}
          </AppText>
        </View>
      </Pressable>
    ));

  const renderBets = () =>
    bets.map((item) => (
      <Pressable
        key={item.bet_id}
        style={[styles.row, { borderBottomColor: theme.borderSubtle }]}
        onPress={() => {
          onSelect({ type: "bet", betId: item.bet_id });
          onClose();
        }}
      >
        {item.market_image_url ? (
          <Image source={{ uri: item.market_image_url }} style={styles.groupAvatar} contentFit="cover" />
        ) : (
          <UserAvatar uri={item.avatar_url} username={item.username} size={36} />
        )}
        <View style={styles.rowText}>
          <AppText variant="bodySm" numberOfLines={1}>
            @{item.username} · {(item.side ?? "").toUpperCase()} {formatCurrency(item.amount)}
          </AppText>
          <AppText variant="caption" color="secondary" numberOfLines={1}>
            {item.market_question}
          </AppText>
        </View>
      </Pressable>
    ));

  const empty =
    (section === "people" && users.length === 0) ||
    (section === "groups" && groups.length === 0) ||
    (section === "bets" && bets.length === 0);

  return (
    <View style={[styles.container, theme.elevation("md"), { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {sections.map((tab) => {
          const active = section === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? theme.primary : theme.background,
                },
              ]}
              onPress={() => setSection(tab.key)}
            >
              <AppText variant="caption" style={{ color: active ? theme.onPrimary : theme.textSecondary }}>
                {tab.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator style={styles.loader} color={theme.primary} />
        ) : empty ? (
          <AppText variant="bodySm" color="secondary" style={styles.empty}>
            {t("mentionEmpty")}
          </AppText>
        ) : section === "people" ? (
          renderPeople()
        ) : section === "groups" ? (
          renderGroups()
        ) : (
          renderBets()
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    marginHorizontal: 10,
    marginBottom: 6,
    maxHeight: 240,
    overflow: "hidden",
  },
  tabs: {
    flexGrow: 0,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  tab: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  list: {
    maxHeight: 180,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  groupAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  loader: {
    padding: 24,
  },
  empty: {
    padding: 20,
    textAlign: "center",
  },
});
