import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlayModeToggle } from "@/components/PlayModeToggle";
import { AppButton, AppIconButton, AppText } from "@/components/ui";
import { BackButton } from "@/components/ui/BackButton";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { DESKTOP_SPLIT_HEADER_HEIGHT, HEADER_HEIGHT, resolveGutter, TABLET_BREAKPOINT } from "@/constants/layout";
import { useIsDesktopWebNav } from "@/contexts/NavigationLayoutContext";
import { useTheme } from "@/contexts/ThemeContext";

const COMPACT_HEADER_BREAKPOINT = 520;

export interface GroupScreenHeaderProps {
  groupName: string;
  avatarUrl?: string | null;
  variant?: "stack" | "split";
  isAdmin?: boolean;
  groupId?: string;
  onBack: () => void;
  onOpenInfo: () => void;
  onCreatePrediction: () => void;
  onManage?: () => void;
  onMemberHelp?: () => void;
}

export function GroupScreenHeader({
  groupName,
  avatarUrl,
  variant = "stack",
  isAdmin = false,
  onBack,
  onOpenInfo,
  onCreatePrediction,
  onManage,
  onMemberHelp,
}: GroupScreenHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktopWebNav = useIsDesktopWebNav();
  const gutter = resolveGutter(width);
  const useStackedLayout = width < COMPACT_HEADER_BREAKPOINT;
  const showPlayToggle = !isDesktopWebNav && width >= TABLET_BREAKPOINT;
  const showBackButton = variant === "stack";
  const isSplitDesktop = variant === "split" && isDesktopWebNav;
  const avatarSize = isSplitDesktop ? 36 : 40;

  const initial = (groupName || "G").substring(0, 1).toUpperCase();

  const identity = (
    <Pressable
      style={[styles.identity, useStackedLayout ? styles.identityStacked : styles.identityInline]}
      onPress={onOpenInfo}
      accessibilityRole="button"
      accessibilityLabel={`Open ${groupName} info`}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: theme.radius.pill }]}
          contentFit="cover"
        />
      ) : (
        <View
          style={[
            styles.avatar,
            {
              width: avatarSize,
              height: avatarSize,
              backgroundColor: theme.primarySoft,
              borderRadius: theme.radius.pill,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <AppText variant="bodySm" color="primary">
            {initial}
          </AppText>
        </View>
      )}
      <View style={styles.identityText}>
        <AppText variant="title3" numberOfLines={1}>
          {groupName || "Group"}
        </AppText>
        <AppText variant="caption" color="secondary" numberOfLines={1}>
          Tap for info
        </AppText>
      </View>
      <IconSymbol name="chevron.right" size={14} color={theme.mutedForeground} />
    </Pressable>
  );

  const createAction = (
    <AppButton
      title={useStackedLayout ? "Create prediction" : "Create"}
      size="sm"
      onPress={onCreatePrediction}
      accessibilityLabel="Create prediction"
      icon={<IconSymbol name="plus" size={16} color={theme.onPrimary} />}
      style={useStackedLayout ? styles.createButtonStacked : styles.createButtonInline}
    />
  );

  return (
    <View
      style={[
        styles.container,
        isSplitDesktop && styles.splitContainer,
        {
          paddingTop: isSplitDesktop ? 0 : insets.top,
          paddingHorizontal: isSplitDesktop ? 16 : gutter,
          backgroundColor: theme.surface,
          borderBottomColor: theme.borderSubtle,
        },
      ]}
    >
      {useStackedLayout ? (
        <>
          <View style={[styles.topRow, { minHeight: HEADER_HEIGHT }]}>
            {showBackButton ? <BackButton onPress={onBack} /> : null}
            <View style={styles.identityWrap}>{identity}</View>
            <AppIconButton
              accessibilityLabel="Group info"
              onPress={onOpenInfo}
              icon={<IconSymbol name="info.circle" size={20} color={theme.primary} />}
            />
            {!isAdmin && onMemberHelp ? (
              <AppIconButton
                accessibilityLabel="Help"
                onPress={onMemberHelp}
                icon={<IconSymbol name="info.circle" size={20} color={theme.primary} />}
              />
            ) : null}
          </View>
          <View style={styles.actionRow}>
            {showPlayToggle ? <PlayModeToggle compact /> : null}
            {isAdmin && onManage ? (
              <AppButton title="Manage" size="sm" variant="secondary" onPress={onManage} />
            ) : null}
            {createAction}
          </View>
        </>
      ) : (
        <View style={[styles.wideRow, isSplitDesktop ? styles.wideRowSplit : { minHeight: HEADER_HEIGHT }]}>
          {showBackButton ? <BackButton onPress={onBack} /> : null}
          <View style={styles.identityWrapWide}>{identity}</View>
          <View style={styles.wideActions}>
            {showPlayToggle ? <PlayModeToggle compact /> : null}
            {isAdmin && onManage ? (
              <AppButton title="Manage" size="sm" variant="secondary" onPress={onManage} />
            ) : null}
            {!isAdmin && onMemberHelp ? (
              <AppIconButton
                accessibilityLabel="Help"
                onPress={onMemberHelp}
                icon={<IconSymbol name="info.circle" size={20} color={theme.primary} />}
              />
            ) : null}
            {createAction}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
    paddingBottom: 12,
  },
  splitContainer: {
    height: DESKTOP_SPLIT_HEADER_HEIGHT,
    justifyContent: "center",
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  wideRowSplit: {
    minHeight: 0,
  },
  identityWrap: {
    flex: 1,
    minWidth: 0,
  },
  identityWrapWide: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 4,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  identityStacked: {
    gap: 10,
  },
  identityInline: {
    gap: 12,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  avatar: {
    width: 40,
    height: 40,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 2,
  },
  wideActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  createButtonStacked: {
    flex: 1,
  },
  createButtonInline: {
    minWidth: 120,
  },
});
