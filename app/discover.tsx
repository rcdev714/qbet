import { WebContentColumn } from "@/components/layout/WebContentColumn";
import { DiscoverPeopleList } from "@/components/social/DiscoverPeopleList";
import { GroupJoinButton } from "@/components/social/GroupJoinButton";
import { UserAvatar } from "@/components/social/UserAvatar";
import { AppText } from "@/components/ui/AppText";
import { EmptyState } from "@/components/ui/EmptyState";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useGroupNavigation } from "@/hooks/useGroupNavigation";
import { groupService, ProfileGroup } from "@/services/group.service";
import { socialService, UserProfile } from "@/services/social.service";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

type DiscoverSegment = "people" | "groups";

export default function DiscoverScreen() {
  const { theme } = useTheme();
  const { openGroup } = useGroupNavigation();
  const { user } = useAuthContext();
  const { t } = useTranslation("social");
  const [segment, setSegment] = useState<DiscoverSegment>("people");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [groups, setGroups] = useState<ProfileGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hydrateFollowState = useCallback(
    async (users: { id: string }[]) => {
      if (!user) return;
      const statuses: Record<string, boolean> = {};
      await Promise.all(
        users.map(async (entry) => {
          statuses[entry.id] = await socialService.getFollowStatus(user.id, entry.id);
        }),
      );
      setFollowingMap((prev) => ({ ...prev, ...statuses }));
    },
    [user],
  );

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    socialService.searchUsers(debouncedQuery).then(async (users) => {
      setResults(users);
      await hydrateFollowState(users);
      setLoading(false);
    });
  }, [debouncedQuery, hydrateFollowState]);

  useEffect(() => {
    if (segment !== "groups") return;
    setGroupsLoading(true);
    groupService.listDiscoverableGroups(30, 0).then((data) => {
      setGroups(data);
      setGroupsLoading(false);
    });
  }, [segment]);

  const showSearchResults = debouncedQuery.length >= 2;

  const searchUsers = results.map((item) => ({
    user_id: item.id,
    username: item.username ?? "user",
    avatar_url: item.avatar_url ?? null,
    created_at: item.created_at ?? new Date().toISOString(),
    total_bets: 0,
    is_following: followingMap[item.id] ?? false,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title={t("discoverTitle")} showBack />

      <WebContentColumn variant="social" style={styles.bodyColumn}>
        <AppText variant="bodySm" color="secondary" style={styles.helper}>
          {t("discoverHelper")}
        </AppText>

        <SegmentedControl
          compact
          value={segment}
          segments={[
            { value: "people" as const, label: t("discoverAllMembers") },
            { value: "groups" as const, label: t("discoverGroups") },
          ]}
          onChange={setSegment}
        />

        {segment === "people" ? (
          <>
            <View
              style={[styles.searchRow, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t("discoverSearchPlaceholder")}
                placeholderTextColor={theme.textSecondary}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {query.trim().length > 0 && query.trim().length < 2 ? (
              <AppText variant="caption" color="secondary" style={styles.minChars}>
                {t("discoverMinChars")}
              </AppText>
            ) : null}

            {showSearchResults ? (
              loading ? (
                <View style={styles.center}>
                  <ActivityIndicator color={theme.primary} />
                </View>
              ) : (
                <DiscoverPeopleList users={searchUsers} scrollEnabled showHeader={false} />
              )
            ) : (
              <DiscoverPeopleList scrollEnabled showHeader suggestedFirst />
            )}
          </>
        ) : groupsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : groups.length === 0 ? (
          <EmptyState icon="people-outline" title={t("discoverGroupsEmpty")} description={t("discoverHelper")} />
        ) : (
          <FlatList
            data={groups}
            keyExtractor={(item) => item.group_id}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.groupRow, { borderBottomColor: theme.border }]}
                onPress={() => openGroup(item.group_id)}
              >
                <UserAvatar uri={item.avatar_url} username={item.name ?? "G"} size={48} />
                <View style={styles.groupMeta}>
                  <AppText variant="body">{item.name}</AppText>
                  <AppText variant="caption" color="secondary">
                    {t("groupStats", {
                      members: item.member_count,
                      markets: item.active_market_count,
                    })}
                  </AppText>
                </View>
                {item.is_member ? (
                  <AppText variant="caption" color="primary">
                    {t("groupMember")}
                  </AppText>
                ) : (
                  <GroupJoinButton groupId={item.group_id} size="sm" />
                )}
              </Pressable>
            )}
          />
        )}
      </WebContentColumn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bodyColumn: { flex: 1, paddingBottom: 16, gap: 12 },
  helper: { lineHeight: 20 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  input: { flex: 1, minHeight: 44, fontSize: 16 },
  minChars: { marginBottom: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 32 },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupMeta: { flex: 1, gap: 4 },
});
