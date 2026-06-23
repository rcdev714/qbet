import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DeleteAccountSection } from '@/components/legal/DeleteAccountSection';
import { ResidenceSettingsSection } from '@/components/profile/ResidenceSettingsSection';
import { useAuthContext } from '@/contexts/AuthContext';
import { ThemeMode, useTheme } from '@/contexts/ThemeContext';

const THEME_OPTIONS: ThemeMode[] = ['system', 'dark', 'light'];

const THEME_LABEL_KEYS: Record<ThemeMode, 'themeSystem' | 'themeDark' | 'themeLight'> = {
  system: 'themeSystem',
  dark: 'themeDark',
  light: 'themeLight',
};

export default function SettingsScreen() {
  const { theme, mode, setMode } = useTheme();
  const { user, signOut } = useAuthContext();
  const { t } = useTranslation('settings');

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      Alert.alert(t('signOutError'), error.message);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: theme.text }]}>{t('title')}</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{t('subtitle')}</Text>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('account')}</Text>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{t('username')}</Text>
          <Text style={[styles.value, { color: theme.text }]}>{user?.username ?? t('notSet')}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>{t('email')}</Text>
          <Text style={[styles.value, { color: theme.text }]}>{user?.email ?? t('notAvailable')}</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('appearance')}</Text>
        <Text style={[styles.helperText, { color: theme.textSecondary }]}>{t('appearanceHelper')}</Text>
        <View style={[styles.modeRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
          {THEME_OPTIONS.map((option) => {
            const selected = mode === option;
            return (
              <Pressable
                key={option}
                onPress={() => setMode(option)}
                style={[
                  styles.modeButton,
                  selected && { backgroundColor: theme.primarySoft, borderColor: theme.primary },
                  Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
                ]}>
                <Text style={[styles.modeButtonText, { color: selected ? theme.primary : theme.text }]}>
                  {t(THEME_LABEL_KEYS[option])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ResidenceSettingsSection theme={theme} />

      <DeleteAccountSection
        theme={theme}
        onDeleted={async () => {
          const { error } = await signOut();
          if (error) {
            Alert.alert(t('signOutIssue'), error.message);
          }
        }}
      />

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('session')}</Text>
        <Text style={[styles.helperText, { color: theme.textSecondary }]}>{t('sessionHelper')}</Text>
        <Pressable
          onPress={handleSignOut}
          style={[
            styles.signOutButton,
            { borderColor: theme.error, backgroundColor: theme.surface },
            Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
          ]}>
          <Text style={[styles.signOutText, { color: theme.error }]}>{t('signOut')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 14,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: -2,
    fontSize: 14,
    marginBottom: 4,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  value: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  modeRow: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 6,
    flexDirection: 'row',
    gap: 6,
  },
  modeButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  signOutButton: {
    marginTop: 2,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
