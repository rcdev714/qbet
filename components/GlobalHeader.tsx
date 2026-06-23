import React from 'react';
import {
    StyleSheet,
    useWindowDimensions,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HEADER_HEIGHT, resolveGutter } from '@/constants/layout';
import { useIsDesktopWebNav } from '@/contexts/NavigationLayoutContext';
import { useTheme } from '@/contexts/ThemeContext';
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
  const isDesktopWeb = useIsDesktopWebNav();
  const { width } = useWindowDimensions();
  const gutter = resolveGutter(width);

  const paddingTop = ignoreTopInset ? 0 : insets.top;
  const showCenterToggle = showToggle && !isDesktopWeb;

  // Sidebar provides nav, settings, and mode toggle on desktop tab screens.
  if (isDesktopWeb && !left) {
    return null;
  }

  const containerStyle = transparent
    ? [styles.container, styles.transparent, { paddingTop }]
    : [styles.container, { paddingTop, backgroundColor: theme.surface, borderBottomColor: theme.borderSubtle }];

  return (
    <View style={containerStyle}>
      <View style={[styles.content, { paddingHorizontal: gutter }]}>
        {/* Left slot */}
        <View style={[styles.side, styles.leftSide, !left && styles.sideEmpty]}>
          {left}
        </View>

        {/* Center slot */}
        <View style={styles.centerSlot}>
          {center ? center : showCenterToggle ? <PlayModeToggle compact transparent={transparent} /> : null}
        </View>

        {/* Right slot */}
        <View style={[styles.side, styles.rightSide, !right && styles.sideEmpty]}>
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
    paddingVertical: 8,
    minHeight: HEADER_HEIGHT,
  },
  side: {
    flex: 1,
    minWidth: 44,
    flexShrink: 0,
  },
  leftSide: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sideEmpty: {
    minWidth: 0,
  },
  centerSlot: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
