import { WhatsAppContactLink } from '@/components/WhatsAppContactLink';
import { Brand } from '@/constants/theme';
import { getPublicEnv } from '@/lib/public-env';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const SignupBanner: React.FC = () => {
  const router = useRouter();
  const isPrivateBeta = getPublicEnv().betaRequired === 'true';

  if (Platform.OS !== 'web') return null;

  return (
    <View style={styles.container}>
      <BlurView intensity={80} tint="light" style={styles.blurContainer}>
        <View style={styles.content}>
          <Text style={styles.text}>
            {isPrivateBeta
              ? 'Anymarkt is in a private invite-only beta.'
              : 'Social prediction markets with friends on Anymarkt.'}
          </Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>
                router.push(isPrivateBeta ? '/login' : { pathname: '/login', params: { mode: 'signup' } })
              }
            >
              <Text style={styles.primaryButtonText}>{isPrivateBeta ? 'Log in' : 'Get started'}</Text>
            </TouchableOpacity>
            {isPrivateBeta ? (
              <WhatsAppContactLink style={styles.whatsappLink} />
            ) : null}
          </View>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 1000,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  blurContainer: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    maxWidth: 1440,
    alignSelf: 'center',
    width: '100%',
    flexWrap: 'wrap',
  },
  text: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    flexShrink: 1,
    color: Brand.deep,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: Brand.primary,
    shadowColor: Brand.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    color: Brand.onPrimary,
    fontSize: 13,
    fontWeight: '400',
  },
  whatsappLink: {
    paddingHorizontal: 4,
  },
});
