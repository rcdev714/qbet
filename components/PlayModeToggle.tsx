import { AppButton, AppText } from '@/components/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { useWalletContext } from '@/contexts/WalletContext';
import { formatCurrency } from '@/lib/parimutuel';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    TouchableOpacity,
    View,
    type ViewStyle,
} from 'react-native';
import { SegmentedControl } from './ui/SegmentedControl';

interface PlayModeToggleProps {
  compact?: boolean;
  transparent?: boolean;
  /** Narrow sidebar rail — single-row control, no split wallet button */
  variant?: 'default' | 'sidebar';
}

export function PlayModeToggle({ compact = false, transparent = false, variant = 'default' }: PlayModeToggleProps) {
  const { theme, isDark } = useTheme();
  const { isPlayMode, toggleMode, playBalance, liveBalance, requestLiveMode } = useWalletContext();
  const { t } = useTranslation('wallet');
  const router = useRouter();
  const [showInfo, setShowInfo] = useState(false);
  const [focusedControl, setFocusedControl] = useState<"balance" | "wallet" | "mode" | null>(null);

  const activeBalance = isPlayMode ? playBalance : liveBalance;
  const modeValue = isPlayMode ? 'play' : 'live';
  const isSidebar = variant === 'sidebar';

  const handleModeChange = (next: 'play' | 'live') => {
    if (next === modeValue) return;
    if (next === 'live') {
      void requestLiveMode();
      return;
    }
    void toggleMode();
  };

  const focusRing =
    Platform.OS === 'web'
      ? ({ boxShadow: `0 0 0 3px ${theme.primarySoft}` } as ViewStyle)
      : null;

  const playAccent = isDark ? theme.primary : theme.primary;
  const liveAccent = theme.success;
  const inactiveLabelColor = theme.textSecondary;
  const glassSurface = isDark ? theme.surface : theme.surface;
  const glassBorder = theme.border;

  const playChipStyle = {
    backgroundColor: theme.primarySoft,
    borderColor: theme.primary,
  };

  const liveChipStyle = {
    backgroundColor: `${theme.success}18`,
    borderColor: `${theme.success}55`,
  };

  /** Compact live: split control — balance / add funds (left), Wallet screen (right). */
  const compactLiveSplit = (
    <View
      style={[
        styles.liveSplitShell,
        isSidebar && styles.liveSplitShellSidebar,
        { borderColor: compact && transparent ? glassBorder : theme.border, borderRadius: theme.radius.md },
        compact && transparent && theme.elevation('sm'),
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Live balance, add funds"
        onPress={() => router.push('/topup' as any)}
        onBlur={() => setFocusedControl(null)}
        onFocus={() => setFocusedControl("balance")}
        activeOpacity={0.85}
        style={[
          styles.liveSplitLeft,
          isSidebar && styles.liveSplitLeftSidebar,
          {
            backgroundColor: compact && transparent ? glassSurface : theme.input,
          },
          Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          focusedControl === "balance" && focusRing,
        ]}
      >
        <View
          style={[
            styles.modeDot,
            { backgroundColor: theme.primary, borderRadius: theme.radius.pill },
          ]}
        />
        <AppText variant="caption" style={{ color: liveAccent }}>Live</AppText>
        <AppText
          variant="bodySm"
          style={{ color: theme.text, flexShrink: 1 }}
          numberOfLines={1}
        >
          {formatCurrency(activeBalance)}
        </AppText>
      </TouchableOpacity>
      {!isSidebar ? (
        <AppButton
          title="Wallet"
          variant="primary"
          size="sm"
          accessibilityLabel="Open wallet"
          onPress={() => router.push('/wallet' as any)}
          onBlur={() => setFocusedControl(null)}
          onFocus={() => setFocusedControl("wallet")}
          style={[
            styles.liveSplitRight,
            { borderLeftColor: theme.borderSubtle },
            focusedControl === "wallet" && focusRing,
          ]}
        />
      ) : null}
    </View>
  );

  const sidebarToggle = (
    <View style={styles.sidebarCompact}>
      <View style={[styles.sidebarCompactTrack, { backgroundColor: theme.input, borderRadius: theme.radius.sm }]}>
        {(['play', 'live'] as const).map((mode) => {
          const active = mode === 'play' ? isPlayMode : !isPlayMode;
          const label = mode === 'play' ? 'Play' : 'Live';
          const activeColor = mode === 'play' ? theme.primary : theme.success;

          return (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${label} mode`}
              onPress={() => handleModeChange(mode)}
              style={({ pressed }) => [
                styles.sidebarCompactSegment,
                { borderRadius: theme.radius.sm },
                active && { backgroundColor: theme.surface },
                Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
                pressed && { opacity: 0.85 },
              ]}>
              <AppText
                variant="caption"
                style={{ color: active ? activeColor : inactiveLabelColor }}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${isPlayMode ? 'Practice' : 'Live'} balance, ${formatCurrency(activeBalance)}`}
        onPress={() => {
          if (!isPlayMode) {
            router.push('/topup' as any);
            return;
          }
          setShowInfo(true);
        }}
        style={({ pressed }) => [
          styles.sidebarCompactBalanceHit,
          Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          pressed && { opacity: 0.75 },
        ]}>
        <AppText
          variant="label"
          color={isPlayMode ? 'primary' : 'success'}
          numberOfLines={1}
          style={{ textAlign: 'center', fontVariant: ['tabular-nums'] }}
        >
          {formatCurrency(activeBalance)}
        </AppText>
      </Pressable>
    </View>
  );

  const walletTouchable =
    isSidebar ? (
      sidebarToggle
    ) : compact && !isPlayMode ? (
      compactLiveSplit
    ) : (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${isPlayMode ? 'Practice' : 'Live'} mode, ${formatCurrency(activeBalance)}`}
        onPress={() => {
          if (!isPlayMode) {
            router.push('/topup' as any);
            return;
          }
          setShowInfo(true);
        }}
        onBlur={() => setFocusedControl(null)}
        onFocus={() => setFocusedControl("mode")}
        activeOpacity={0.8}
        style={[
          styles.toggleRow,
          isSidebar && [styles.toggleRowSidebar, { borderRadius: theme.radius.sm }],
          transparent ? styles.transparentRow : null,
          compact && !transparent && isPlayMode && [styles.headerModeChip, playChipStyle, { borderRadius: theme.radius.pill }],
          compact && !transparent && !isPlayMode && [styles.headerModeChip, liveChipStyle, { borderRadius: theme.radius.pill }],
          compact && transparent && isPlayMode && [
            styles.headerPlayBackdrop,
            theme.elevation('sm'),
            { backgroundColor: glassSurface, borderWidth: StyleSheet.hairlineWidth, borderColor: glassBorder, borderRadius: theme.radius.pill },
          ],
          Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
          focusedControl === "mode" && focusRing,
        ]}
      >
        <View
          style={[
            styles.modeDot,
            { backgroundColor: isPlayMode ? theme.primary : theme.success, borderRadius: theme.radius.pill },
          ]}
        />
        <AppText
          variant="label"
          style={{
            color: transparent
              ? isPlayMode
                ? playAccent
                : theme.onPrimary
              : isPlayMode
                ? playAccent
                : liveAccent,
            ...(transparent && !isPlayMode
              ? {
                  textShadowColor: theme.overlay,
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }
              : {}),
          }}
        >
          {isPlayMode ? 'Play' : 'Live'}
        </AppText>
        {(!compact || !isPlayMode) && (
          <AppText
            variant="caption"
            style={{
              color: transparent ? theme.text : inactiveLabelColor,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatCurrency(activeBalance)}
          </AppText>
        )}
      </TouchableOpacity>
    );

  const segment =
    !compact && !transparent ? (
      <View style={styles.segmentWrapper}>
        <SegmentedControl
          value={modeValue}
          segments={[
            { value: 'play', label: 'Practice', description: 'Trial credits' },
            { value: 'live', label: 'Live', description: 'Real money', testID: 'mode-toggle-live' },
          ]}
          onChange={(next) => handleModeChange(next as 'play' | 'live')}
        />
      </View>
    ) : null;

  const infoModal = (
    <Modal
        visible={showInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfo(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}
          onPress={() => setShowInfo(false)}
        >
          <View style={[
            styles.infoPopup,
            theme.elevation('lg'),
            { backgroundColor: theme.surface, borderRadius: theme.radius.lg }
          ]}>
            <AppText variant="title2" style={{ textAlign: 'center', marginBottom: 12 }}>
              {isPlayMode ? 'Practice mode is on' : 'Live mode is on'}
            </AppText>
            <AppText variant="bodySm" color="secondary" style={{ textAlign: 'center', marginBottom: 20 }}>
              {isPlayMode
                ? "You're using trial credits to learn how markets work. No real money is used in Practice mode."
                : 'You are using real money. Deposits, withdrawals, and live bets are processed through Stripe.'
              }
            </AppText>

            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <AppText variant="caption" color="primary" style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  {t('playBalanceLabel')}
                </AppText>
                <AppText variant="title2">{formatCurrency(playBalance)}</AppText>
              </View>
              <View style={styles.balanceItem}>
                <AppText variant="caption" color="success" style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  {t('liveBalanceLabel')}
                </AppText>
                <AppText variant="title2">{formatCurrency(liveBalance)}</AppText>
              </View>
            </View>

            <AppButton
              testID="mode-switch-to-live"
              title={isPlayMode ? t('switchToLive') : t('switchToPlay')}
              variant="primary"
              size="md"
              onPress={async () => {
                if (isPlayMode) {
                  const ok = await requestLiveMode();
                  if (ok) setShowInfo(false);
                } else {
                  await toggleMode();
                  setShowInfo(false);
                }
              }}
              style={{ marginBottom: 12 }}
            />

            {!isPlayMode && (
              <AppButton
                title={t('addLiveFunds')}
                variant="primary"
                size="md"
                onPress={() => {
                  setShowInfo(false);
                  router.push('/topup' as any);
                }}
                style={{ marginBottom: 12 }}
              />
            )}

            <AppButton
              title={t('close')}
              variant="ghost"
              size="sm"
              onPress={() => setShowInfo(false)}
            />
          </View>
        </Pressable>
      </Modal>
  );

  if (compact) {
    return (
      <>
        {walletTouchable}
        {!isSidebar ? segment : null}
        {infoModal}
      </>
    );
  }

  return (
    <View style={styles.container}>
      {walletTouchable}
      {segment}
      {infoModal}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
  },
  toggleRowSidebar: {
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  sidebarCompact: {
    alignSelf: 'stretch',
    gap: 4,
  },
  sidebarCompactTrack: {
    flexDirection: 'row',
    padding: 2,
    gap: 2,
  },
  sidebarCompactSegment: {
    flex: 1,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sidebarCompactBalanceHit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: 4,
  },
  transparentRow: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  headerPlayBackdrop: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  headerModeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  liveSplitShell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  liveSplitShellSidebar: {
    width: '100%',
    maxWidth: '100%',
  },
  liveSplitLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexShrink: 1,
  },
  liveSplitLeftSidebar: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  liveSplitRight: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  modeDot: {
    width: 8,
    height: 8,
  },
  segmentWrapper: {
    width: 260,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoPopup: {
    width: '100%',
    maxWidth: 320,
    padding: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  balanceItem: {
    alignItems: 'center',
  },
});
