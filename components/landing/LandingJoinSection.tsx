import { Brand, Marketing } from '@/constants/theme';
import type { ComplianceJurisdiction } from '@/lib/compliance/jurisdiction';
import { getJurisdictionDisclaimer, getJurisdictionLabel } from '@/lib/compliance/jurisdiction';
import {
  getPolicyDocuments,
  POLICY_ROUTE_ORDER,
  policyRouteWithJurisdiction,
} from '@/lib/legal/policy-content';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { WhatsAppContactLink } from '../WhatsAppContactLink';

const POLICY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  terms: 'document-text-outline',
  privacy: 'shield-checkmark-outline',
  risk_disclosure: 'alert-circle-outline',
  market_rules: 'list-outline',
  aml_kyc: 'id-card-outline',
  prohibited_markets: 'ban-outline',
};

type Props = {
  launchJurisdiction: ComplianceJurisdiction;
  isPrivateBeta: boolean;
  residentLabel: string;
  onPrimaryAction: () => void;
  primaryLabel: string;
  accessSteps?: string[];
};

export function LandingJoinSection({
  launchJurisdiction,
  isPrivateBeta,
  residentLabel,
  onPrimaryAction,
  primaryLabel,
  accessSteps = [],
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 820;
  const policyDocuments = React.useMemo(() => getPolicyDocuments(launchJurisdiction), [launchJurisdiction]);
  const jurisdictionLabel = getJurisdictionLabel(launchJurisdiction);
  const jurisdictionDisclaimer = getJurisdictionDisclaimer(launchJurisdiction);

  return (
    <View style={styles.wrap}>
      <View style={styles.ctaPanel}>
        <Text style={styles.chapterEyebrow}>04 · Join</Text>
        <Text style={styles.headline}>Ready to predict with your people?</Text>
        <Text style={styles.subline}>
          {isPrivateBeta
            ? `Private invite-only beta for ${residentLabel} residents. Request access to get started.`
            : 'Create your first group market in minutes. Play credits included — no wallet required to start.'}
        </Text>

        {isPrivateBeta && accessSteps.length > 0 ? (
          <View style={styles.stepsRow}>
            {accessSteps.map((step, index) => (
              <View key={step} style={styles.stepChip}>
                <Text style={styles.stepChipIndex}>{index + 1}</Text>
                <Text style={styles.stepChipLabel}>{step}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={onPrimaryAction}
          style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
            styles.primaryButton,
            (hovered || pressed) && styles.primaryButtonActive,
            Platform.OS === 'web' && ({ cursor: 'pointer' } as object),
          ]}
        >
          <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>

        {isPrivateBeta ? (
          <View style={styles.helpRow}>
            <Text style={styles.helpText}>Need help?</Text>
            <WhatsAppContactLink variant="link" iconSize={18} />
          </View>
        ) : null}

        <View style={styles.trustStrip}>
          {['Private groups', 'Play credits', '17+ only'].map((item) => (
            <View key={item} style={styles.trustItem}>
              <Ionicons name="checkmark-circle" size={14} color="#86EFAC" />
              <Text style={styles.trustText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footerPanel}>
        <View style={[styles.footerGrid, isWide && styles.footerGridWide]}>
          <View style={styles.footerBrandCol}>
            <View style={styles.footerBrandRow}>
              <Image source={require('../../assets/images/icon.svg')} style={styles.footerLogo} contentFit="contain" />
              <Text style={styles.footerBrand}>Anymarkt</Text>
            </View>
            <Text style={styles.footerTagline}>Future prediction infrastructure for private groups.</Text>
            <WhatsAppContactLink style={styles.footerWhatsApp} />
            <Text style={styles.footerCopy}>© {new Date().getFullYear()} Anymarkt · 17+</Text>
          </View>

          <View style={styles.footerLinksCol}>
            <Text style={styles.footerColTitle}>Legal & policies</Text>
            <View style={[styles.linkGrid, isWide && styles.linkGridWide]}>
              {POLICY_ROUTE_ORDER.map((kind) => {
                const doc = policyDocuments[kind];
                const icon = POLICY_ICONS[kind] ?? 'document-outline';
                return (
                  <TouchableOpacity
                    key={kind}
                    onPress={() => router.push(policyRouteWithJurisdiction(doc.route, launchJurisdiction) as any)}
                    style={[styles.linkRow, Platform.OS === 'web' && ({ cursor: 'pointer' } as object)]}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={icon} size={15} color="#93C5FD" />
                    <Text style={styles.linkText}>{doc.title}</Text>
                    <Ionicons name="chevron-forward" size={12} color={Marketing.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.complianceBlock}>
          <Text style={styles.complianceTitle}>Compliance notice</Text>
          <Text style={styles.complianceBody}>
            {jurisdictionLabel}. {jurisdictionDisclaimer} Not investment advice. Prediction markets involve risk. Only
            participate with funds you can afford to lose.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 32,
    paddingBottom: 48,
  },
  ctaPanel: {
    borderRadius: 24,
    padding: 28,
    gap: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 106, 220, 0.22)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
        } as object)
      : {}),
  },
  chapterEyebrow: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headline: {
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '300',
    letterSpacing: -1.2,
    maxWidth: 520,
  },
  subline: {
    color: Marketing.textMuted,
    fontSize: 16,
    lineHeight: 26,
    maxWidth: 560,
  },
  stepsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  stepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Marketing.heroBorder,
    backgroundColor: 'rgba(0, 106, 220, 0.08)',
  },
  stepChipIndex: {
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(0, 106, 220, 0.18)',
    overflow: 'hidden',
  },
  stepChipLabel: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    minHeight: 52,
    paddingHorizontal: 24,
    backgroundColor: Brand.primary,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 14px 28px rgba(0, 106, 220, 0.28)',
          transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        } as object)
      : {}),
  },
  primaryButtonActive: {
    ...(Platform.OS === 'web' ? ({ transform: 'translateY(-2px) scale(1.02)' } as object) : {}),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpText: {
    color: Marketing.textMuted,
    fontSize: 13,
  },
  trustStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: Marketing.heroBorder,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustText: {
    color: Marketing.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  footerPanel: {
    borderRadius: 20,
    padding: 24,
    gap: 24,
    borderWidth: 1,
    borderColor: Marketing.heroBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  footerGrid: {
    gap: 28,
  },
  footerGridWide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 48,
  },
  footerBrandCol: {
    flex: 1,
    gap: 10,
    maxWidth: 340,
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerLogo: {
    width: 32,
    height: 32,
  },
  footerBrand: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  footerTagline: {
    color: Marketing.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  footerWhatsApp: {
    paddingTop: 4,
  },
  footerCopy: {
    color: Marketing.textMuted,
    fontSize: 12,
    paddingTop: 4,
  },
  footerLinksCol: {
    flex: 1.2,
    gap: 12,
    minWidth: 260,
  },
  footerColTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  linkGrid: {
    gap: 4,
  },
  linkGridWide: {
    gap: 2,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 160ms ease',
        } as object)
      : {}),
  },
  linkText: {
    flex: 1,
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '500',
  },
  complianceBlock: {
    gap: 8,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Marketing.heroBorder,
  },
  complianceTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  complianceBody: {
    color: Marketing.textMuted,
    fontSize: 12,
    lineHeight: 19,
    maxWidth: 900,
  },
});
