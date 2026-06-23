import { WHATSAPP_CONTACT_DISPLAY, openWhatsAppContact } from '@/lib/contact';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

type WhatsAppContactLinkProps = {
  style?: ViewStyle;
  iconSize?: number;
  label?: string;
  variant?: 'link' | 'primary';
};

export function WhatsAppContactLink({
  style,
  iconSize = 16,
  label,
  variant = 'link',
}: WhatsAppContactLinkProps) {
  const isPrimary = variant === 'primary';
  const displayLabel = label ?? (isPrimary ? 'Request access' : WHATSAPP_CONTACT_DISPLAY);

  return (
    <TouchableOpacity
      onPress={openWhatsAppContact}
      style={[
        isPrimary ? styles.primaryButton : styles.row,
        style,
        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
      ]}
      activeOpacity={0.85}
    >
      <Ionicons
        name="logo-whatsapp"
        size={iconSize}
        color={isPrimary ? '#FFFFFF' : '#25D366'}
      />
      <Text style={isPrimary ? styles.primaryText : styles.linkText}>{displayLabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkText: {
    color: '#93C5FD',
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 14,
    minWidth: 220,
    height: 56,
    paddingHorizontal: 24,
    backgroundColor: '#25D366',
    ...Platform.select({
      web: {
        boxShadow: '0px 12px 20px rgba(37, 211, 102, 0.28)',
      },
      default: {
        shadowColor: '#25D366',
        shadowOpacity: 0.28,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 5,
      },
    }),
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
