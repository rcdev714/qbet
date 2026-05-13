import React, { useRef } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
}

export function CodeInput({ value, onChange, length = 6, autoFocus = false }: CodeInputProps) {
  const { theme, isDark } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const cells = Array(length).fill(0);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const handleChangeText = (text: string) => {
    // Only allow alphanumeric characters and limit to length
    const cleaned = text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (cleaned.length <= length) {
      onChange(cleaned);
    }
  };

  return (
    <TouchableOpacity 
      activeOpacity={1} 
      onPress={handlePress} 
      style={styles.container}
    >
      <View style={styles.cellsContainer}>
        {cells.map((_, index) => {
          const char = value[index] || '';
          const isFocused = value.length === index;
          const isFilled = value.length > index;

          return (
            <View
              key={index}
              style={[
                styles.cell,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F2F2F7',
                  borderColor: isFocused ? theme.primary : (isFilled ? theme.primary + '40' : theme.border),
                  borderWidth: isFocused ? 2 : 1,
                },
              ]}
            >
              <Text style={[styles.cellText, { color: theme.text }]}>
                {char}
              </Text>
              {isFocused && (
                <View style={[styles.cursor, { backgroundColor: theme.primary }]} />
              )}
            </View>
          );
        })}
      </View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChangeText}
        maxLength={length}
        style={styles.hiddenInput}
        autoFocus={autoFocus}
        keyboardType="default"
        autoCapitalize="characters"
        autoCorrect={false}
        textContentType="oneTimeCode"
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
  },
  cellsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  cell: {
    width: 44,
    height: 54,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      },
    }),
  },
  cellText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  cursor: {
    position: 'absolute',
    bottom: 10,
    width: 20,
    height: 2,
    borderRadius: 1,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.01,
    zIndex: 10, // Ensure it sits on top of the cells
    // @ts-ignore
    cursor: 'text', // Show text cursor on hover for Web
  },
});
