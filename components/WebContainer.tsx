import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { Platform, StyleSheet, View, ViewProps } from 'react-native';

interface WebContainerProps extends ViewProps {
  maxWidth?: number | 'fluid';
  /** When set (e.g. marketing pages), overrides theme.background for the web shell gutters and column. */
  shellBackgroundColor?: string;
}

export const WebContainer: React.FC<WebContainerProps> = ({ 
  children, 
  maxWidth = 'fluid', 
  shellBackgroundColor,
  style,
  ...props 
}) => {
  const { theme } = useTheme();
  const contentMaxWidth = maxWidth === 'fluid' ? undefined : maxWidth;
  const backgroundColor = shellBackgroundColor ?? theme.background;

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
        },
        ({ minHeight: '100dvh' } as any),
      ]}
    >
      <View
        style={[
          styles.content,
          {
            maxWidth: contentMaxWidth,
            backgroundColor,
            width: '100%',
          },
          ({ minHeight: '100dvh' } as any),
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    minHeight: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
});
