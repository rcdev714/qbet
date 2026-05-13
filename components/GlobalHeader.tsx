import React from 'react';
import {
    StyleSheet,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { PlayModeToggle } from './PlayModeToggle';

interface GlobalHeaderProps {
  /** Optional left element (e.g., back button) */
  left?: React.ReactNode;
  /** Optional center element (overrides PlayModeToggle) */
  center?: React.ReactNode;
  /** Optional right element (e.g., settings button) */
  right?: React.ReactNode;
  /** Whether to show the toggle (default: true) */
  showToggle?: boolean;
  /** Whether header is transparent/overlay (doesn't affect layout) */
  transparent?: boolean;
  /** Whether to ignore top safe area inset (useful if parent already has it) */
  ignoreTopInset?: boolean;
}

/**
 * Global header component with centered Play/Live mode toggle.
 * This provides a consistent toggle position across all screens.
 * The toggle state is managed by WalletContext (singleton).
 */
export function GlobalHeader({ 
  left, 
  right, 
  center,
  showToggle = true,
  transparent = false,
  ignoreTopInset = false
}: GlobalHeaderProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const paddingTop = ignoreTopInset ? 0 : insets.top;

  const containerStyle = transparent
    ? [styles.container, styles.transparent, { paddingTop }]
    : [styles.container, { paddingTop, backgroundColor: theme.surface, borderBottomColor: theme.border }];

  return (
    <View style={containerStyle}>
      <View style={styles.content}>
        {/* Left slot */}
        <View style={styles.side}>
          {left}
        </View>

        {/* Center slot */}
        <View style={styles.centerSlot}>
          {center ? center : showToggle ? <PlayModeToggle compact transparent /> : null}
        </View>

        {/* Right slot */}
        <View style={[styles.side, styles.rightSide]}>
          {right}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  transparent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
  },
  side: {
    minWidth: 44,
    alignItems: 'flex-start',
  },
  rightSide: {
    alignItems: 'flex-end',
  },
  centerSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
