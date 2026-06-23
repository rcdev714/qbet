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
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useWalletContext } from '../contexts/WalletContext';
import { formatCurrency } from '../lib/parimutuel';
import { SegmentedControl } from './ui/SegmentedControl';

interface PlayModeToggleProps {
  compact?: boolean;
  transparent?: boolean;
}

export function PlayModeToggle({ compact = false, transparent = false }: PlayModeToggleProps) {
  const { theme, isDark } = useTheme();
  const { isPlayMode, toggleMode, playBalance, liveBalance, requestLiveMode } = useWalletContext();
  const { t } = useTranslation('wallet');
  const router = useRouter();
  const [showInfo, setShowInfo] = useState(false);
  const [focusedControl, setFocusedControl] = useState<"balance" | "wallet" | "mode" | null>(null);

  const activeBalance = isPlayMode ? playBalance : liveBalance;
  const modeValue = isPlayMode ? 'play' : 'live';
  const focusRing =
    Platform.OS === 'web'
      ? ({ boxShadow: `0 0 0 3px ${theme.primarySoft}` } as any)
      : null;

  /** Compact live: split control — balance / add funds (left), Wallet screen (right). */
  const compactLiveSplit = (
    <View
      style={[
        styles.liveSplitShell,
        { borderColor: theme.border },
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
          { backgroundColor: theme.input },
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
        <Text style={[styles.liveSplitLabel, { color: theme.textSecondary }]}>Live</Text>
        <Text style={[styles.liveSplitBalance, { color: theme.text }]} numberOfLines={1}>
          {formatCurrency(activeBalance)}
        </Text>
      </TouchableOpacity>
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
    </View>
  );

  const walletTouchable =
    compact && !isPlayMode ? (
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
          transparent ? styles.transparentRow : null,
          compact && transparent && isPlayMode && styles.headerPlayBackdrop,
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
            { color: transparent ? '#fff' : theme.text },
            transparent &&
              isPlayMode && {
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
              { color: transparent ? '#fff' : theme.textSecondary },
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
            { value: 'live', label: 'Live', description: 'Real money' },
          ]}
          onChange={(next) => {
            if (next === modeValue) return;
            if (next === 'live') {
              void requestLiveMode();
              return;
            }
            void toggleMode();
          }}
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
        {segment}
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
    minHeight: 44,
  },
  transparentRow: {
    backgroundColor: 'transparent',
    padding: 0,
  },
  headerPlayBackdrop: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  liveSplitShell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
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
  liveSplitBalance: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  liveSplitWalletLabel: {
    fontSize: 13,
    fontWeight: '700',
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
