import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    type ViewStyle,
} from 'react-native';
import { FontWeight } from '../constants/typography';
import { useTheme } from '../contexts/ThemeContext';
import { useWalletContext } from '../contexts/WalletContext';
import { formatCurrency } from '../lib/parimutuel';
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
      ? ({ boxShadow: `0 0 0 3px ${theme.primarySoft}` } as any)
      : null;

  const playAccent = isDark ? '#93C5FD' : theme.primary;
  const liveAccent = isDark ? '#86EFAC' : theme.success;
  const inactiveLabelColor = isDark ? '#CBD5E1' : theme.textSecondary;
  const glassSurface = isDark ? 'rgba(36, 45, 58, 0.92)' : 'rgba(255,255,255,0.92)';
  const glassBorder = isDark ? 'rgba(255,255,255,0.14)' : theme.border;

  const playChipStyle = isDark
    ? { backgroundColor: 'rgba(0, 106, 220, 0.28)', borderColor: 'rgba(147, 197, 253, 0.45)' }
    : { backgroundColor: theme.primarySoft, borderColor: theme.primary };

  const liveChipStyle = isDark
    ? { backgroundColor: 'rgba(34, 197, 94, 0.22)', borderColor: 'rgba(134, 239, 172, 0.45)' }
    : { backgroundColor: `${theme.success}18`, borderColor: `${theme.success}55` };

  /** Compact live: split control — balance / add funds (left), Wallet screen (right). */
  const compactLiveSplit = (
    <View
      style={[
        styles.liveSplitShell,
        isSidebar && styles.liveSplitShellSidebar,
        { borderColor: compact && transparent ? glassBorder : theme.border },
        compact && transparent && styles.liveSplitShadow,
      ]}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Live balance, add funds"
        onPress={() => router.push('/topup' as any)}
        onBlur={() => setFocusedControl(null)}
        onFocus={() => setFocusedControl("balance")}
        activeOpacity={0.85}
        // @ts-ignore
        style={[
          styles.liveSplitLeft,
          isSidebar && styles.liveSplitLeftSidebar,
          {
            backgroundColor:
              compact && transparent ? glassSurface : theme.input,
          },
          Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
          focusedControl === "balance" && focusRing,
        ]}
      >
        <View
          style={[
            styles.modeDot,
            { backgroundColor: theme.primary },
          ]}
        />
        <Text style={[styles.liveSplitLabel, isSidebar && styles.liveSplitLabelSidebar, { color: liveAccent }]}>Live</Text>
        <Text
          style={[
            styles.liveSplitBalance,
            isSidebar && styles.liveSplitBalanceSidebar,
            { color: compact && transparent && isDark ? '#F3F4F6' : theme.text },
          ]}
          numberOfLines={1}
        >
          {formatCurrency(activeBalance)}
        </Text>
      </TouchableOpacity>
      {!isSidebar ? (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Open wallet"
        onPress={() => router.push('/wallet' as any)}
        onBlur={() => setFocusedControl(null)}
        onFocus={() => setFocusedControl("wallet")}
        activeOpacity={0.85}
        // @ts-ignore
        style={[
          styles.liveSplitRight,
          { backgroundColor: theme.primary, borderLeftColor: 'rgba(255,255,255,0.14)' },
          Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
          focusedControl === "wallet" && focusRing,
        ]}
      >
        <Text style={[styles.liveSplitWalletLabel, { color: theme.onPrimary }]}>Wallet</Text>
      </TouchableOpacity>
      ) : null}
    </View>
  );

  const sidebarToggle = (
    <View style={styles.sidebarCompact}>
      <View style={[styles.sidebarCompactTrack, { backgroundColor: theme.input }]}>
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
                active && { backgroundColor: theme.surface },
                Platform.OS === 'web' && ({ cursor: 'pointer' } as ViewStyle),
                pressed && { opacity: 0.85 },
              ]}>
              <Text
                style={[
                  styles.sidebarCompactSegmentLabel,
                  { color: active ? activeColor : inactiveLabelColor },
                  active && styles.sidebarCompactSegmentLabelActive,
                ]}>
                {label}
              </Text>
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
        <Text
          style={[
            styles.sidebarCompactBalance,
            { color: isPlayMode ? theme.primary : theme.success },
          ]}
          numberOfLines={1}>
          {formatCurrency(activeBalance)}
        </Text>
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
        // @ts-ignore
        style={[
          styles.toggleRow,
          isSidebar && styles.toggleRowSidebar,
          transparent ? styles.transparentRow : null,
          compact && !transparent && isPlayMode && [styles.headerModeChip, playChipStyle],
          compact && !transparent && !isPlayMode && [styles.headerModeChip, liveChipStyle],
          compact && transparent && isPlayMode && [
            styles.headerPlayBackdrop,
            isDark && styles.headerPlayBackdropDark,
            isDark && { backgroundColor: glassSurface, borderWidth: StyleSheet.hairlineWidth, borderColor: glassBorder },
          ],
          Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
          focusedControl === "mode" && focusRing,
        ]}
      >
        <View
          style={[
            styles.modeDot,
            { backgroundColor: isPlayMode ? theme.primary : theme.success },
          ]}
        />
        <Text
          style={[
            styles.modeLabel,
            {
              color: transparent
                ? isPlayMode
                  ? isDark
                    ? playAccent
                    : theme.primary
                  : '#fff'
                : isPlayMode
                  ? playAccent
                  : liveAccent,
            },
            transparent &&
              !isPlayMode && {
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              },
          ]}
        >
          {isPlayMode ? 'Play' : 'Live'}
        </Text>
        {(!compact || !isPlayMode) && (
          <Text
            style={[
              styles.balanceText,
              compact && isPlayMode && styles.liveBalanceText,
              {
                color: transparent
                  ? isDark
                    ? '#E5E7EB'
                    : '#fff'
                  : inactiveLabelColor,
              },
            ]}
          >
            {formatCurrency(activeBalance)}
          </Text>
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
          style={styles.modalOverlay}
          onPress={() => setShowInfo(false)}
        >
          <View style={[
            styles.infoPopup,
            { backgroundColor: isDark ? theme.surface : '#fff' }
          ]}>
            <Text style={[styles.infoTitle, { color: theme.text }]}>
              {isPlayMode ? 'Practice mode is on' : 'Live mode is on'}
            </Text>
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {isPlayMode 
                ? "You're using trial credits to learn how markets work. No real money is used in Practice mode."
                : 'You are using real money. Deposits, withdrawals, and live bets are processed through Stripe.'
              }
            </Text>

            <View style={styles.balanceRow}>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceLabel, { color: theme.primary }]}>{t('playBalanceLabel')}</Text>
                <Text style={[styles.balanceValue, { color: theme.text }]}>
                  {formatCurrency(playBalance)}
                </Text>
              </View>
              <View style={styles.balanceItem}>
                <Text style={[styles.balanceLabel, { color: theme.success }]}>{t('liveBalanceLabel')}</Text>
                <Text style={[styles.balanceValue, { color: theme.text }]}>
                  {formatCurrency(liveBalance)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              testID="mode-switch-to-live"
              style={[styles.switchButton, { backgroundColor: theme.primary }]}
              onPress={async () => {
                if (isPlayMode) {
                  const ok = await requestLiveMode();
                  if (ok) setShowInfo(false);
                } else {
                  await toggleMode();
                  setShowInfo(false);
                }
              }}
            >
              <Text style={[styles.switchButtonText, { color: theme.onPrimary }]}>
                {isPlayMode ? t('switchToLive') : t('switchToPlay')}
              </Text>
            </TouchableOpacity>

            {!isPlayMode && (
              <TouchableOpacity
                style={[styles.addFundsButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setShowInfo(false);
                  router.push('/topup' as any);
                }}
              >
                <Text style={[styles.addFundsButtonText, { color: theme.onPrimary }]}>{t('addLiveFunds')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowInfo(false)}
            >
              <Text style={[styles.closeButtonText, { color: theme.textSecondary }]}>
                {t('close')}
              </Text>
            </TouchableOpacity>
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
    borderRadius: 10,
    overflow: 'hidden',
  },
  sidebarCompact: {
    alignSelf: 'stretch',
    gap: 4,
  },
  sidebarCompactTrack: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  sidebarCompactSegment: {
    flex: 1,
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  sidebarCompactSegmentLabel: {
    fontSize: 12,
    fontWeight: FontWeight.regular,
    letterSpacing: -0.1,
  },
  sidebarCompactSegmentLabelActive: {
    fontWeight: FontWeight.regular,
  },
  sidebarCompactBalanceHit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 22,
    paddingHorizontal: 4,
  },
  sidebarCompactBalance: {
    fontSize: 13,
    fontWeight: FontWeight.regular,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  transparentRow: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  headerPlayBackdrop: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerPlayBackdropDark: {
    shadowOpacity: 0.35,
  },
  headerModeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  liveSplitShell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  liveSplitShellSidebar: {
    width: '100%',
    maxWidth: '100%',
  },
  liveSplitShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
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
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  liveSplitLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  liveSplitLabelSidebar: {
    fontSize: 11,
  },
  liveSplitBalance: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  liveSplitBalanceSidebar: {
    fontSize: 12,
    fontWeight: '600',
  },
  liveSplitWalletLabel: {
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: -0.1,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  balanceText: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  liveBalanceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  segmentWrapper: {
    width: 260,
    marginTop: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  infoPopup: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  switchButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  switchButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  addFundsButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  addFundsButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  closeButton: {
    alignItems: 'center',
    padding: 8,
  },
  closeButtonText: {
    fontSize: 14,
  },
});
