import React, { useEffect, useRef, useState } from 'react';
import {
    Dimensions,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface RulesModalProps {
  visible: boolean;
  onClose: () => void;
  initialPage?: number;
}

const { width: windowWidth } = Dimensions.get('window');
const MAX_WEB_WIDTH = 600;
// We subtract 32 for padding if needed, but for full page modal we might want to center it
const SCREEN_WIDTH = Platform.OS === 'web' ? Math.min(windowWidth, MAX_WEB_WIDTH) : windowWidth;

const PAGES = [
  {
    title: "AnyMarket",
    icon: "✨",
    content: (theme: any, isDark: boolean) => (
      <View>
        <Text style={[styles.bodyText, { color: theme.text }]}>
          Social prediction infrastructure for private groups. Learn in Practice mode, participate in Live only after verification.
        </Text>
        <View style={styles.featureList}>
          <View style={styles.featureItem}>
             <Text style={styles.featureIcon}>🎯</Text>
             <View>
               <Text style={[styles.featureTitle, { color: theme.text }]}>Objective resolution</Text>
               <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>Markets settle on published criteria and source of truth.</Text>
             </View>
          </View>
          <View style={styles.featureItem}>
             <Text style={styles.featureIcon}>🤝</Text>
             <View>
               <Text style={[styles.featureTitle, { color: theme.text }]}>Parimutuel pools</Text>
               <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>Winners share the pool—AnyMarket is facilitator, not counterparty.</Text>
             </View>
          </View>
        </View>
      </View>
    )
  },
  {
    title: "Private vs. Global",
    icon: "🌐",
    content: (theme: any, isDark: boolean) => (
      <View>
        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderLeftColor: theme.primary, borderLeftWidth: 4 }]}>
          <Text style={[styles.cardTag, { color: theme.primary }]}>PRIVATE GROUPS</Text>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Bet Friends</Text>
          <Text style={[styles.cardBody, { color: theme.textSecondary }]}>
            Create markets inside group chats and DMs. Perfect for internal bets, challenges, and local events.
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.surface, borderLeftColor: '#9B59B6', borderLeftWidth: 4, marginTop: 16 }]}>
          <Text style={[styles.cardTag, { color: '#9B59B6' }]}>GLOBAL FEED</Text>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Curated Markets</Text>
          <Text style={[styles.cardBody, { color: theme.textSecondary }]}>
            For now, only official <Text style={{fontWeight: '600', color: '#0090ff'}}>AnyMarket</Text> hosts can publish to the global feed to ensure quality and fair resolution.
          </Text>
        </View>
      </View>
    )
  },
  {
    title: "Risk-Free Learning",
    icon: "🕹️",
    content: (theme: any, isDark: boolean) => (
      <View>
        <Text style={[styles.bodyText, { color: theme.text, marginBottom: 24 }]}>
          Master prediction markets before putting real money on the line.
        </Text>
        <View style={[styles.playModeCard, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
          <Text style={[styles.playModeBalance, { color: '#9B59B6' }]}>$1,000</Text>
          <Text style={[styles.playModeLabel, { color: theme.textSecondary }]}>TRIAL PLAY CREDITS</Text>
          <Text style={[styles.playModeDesc, { color: theme.textSecondary }]}>
            Every user starts with a free balance. Test your intuition on any market using Play Mode tokens.
          </Text>
        </View>
      </View>
    )
  },
  {
    title: "Fees & Secure Payouts",
    icon: "🛡️",
    content: (theme: any, isDark: boolean) => (
      <View>
        <Text style={[styles.bodyText, { color: theme.text, marginBottom: 20 }]}>
          We use Stripe to ensure every withdrawal is instant and secure.
        </Text>

        <View style={[styles.feeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.feeHeader, { color: theme.textSecondary }]}>DYNAMIC WITHDRAWAL FEES</Text>
          
          <View style={styles.table}>
            <View style={styles.row}>
              <Text style={[styles.td, { color: theme.text }]}>$15 Withdrawal</Text>
              <Text style={[styles.td, { color: theme.error, fontWeight: '600' }]}>~12%</Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.td, { color: theme.text }]}>$100 Withdrawal</Text>
              <Text style={[styles.td, { color: theme.text, fontWeight: '600' }]}>~5%</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={[styles.td, { color: theme.text }]}>$500+ Withdrawal</Text>
              <Text style={[styles.td, { color: '#34C759', fontWeight: '600' }]}>~2%</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.note, { color: theme.textSecondary, marginTop: 12 }]}>
          * Standard minimum withdrawal: $15
        </Text>
      </View>
    )
  }
];

export function RulesModal({ visible, onClose, initialPage = 0 }: RulesModalProps) {
  const { theme, isDark } = useTheme();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      setCurrentPage(initialPage);
      // Wait for layout
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: initialPage * SCREEN_WIDTH, animated: false });
      }, 50);
    }
  }, [visible, initialPage]);

  const handleScroll = (event: any) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentPage(slide);
  };

  return (
    <Modal animationType="slide" transparent={false} visible={visible} presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <View style={styles.indicatorContainer}>
            {PAGES.map((_, index) => (
              <View 
                key={index} 
                style={[
                  styles.indicator, 
                  { backgroundColor: index === currentPage ? theme.primary : theme.border }
                ]} 
              />
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={[styles.closeText, { color: theme.textSecondary }]}>Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {PAGES.map((page, index) => (
            <View key={index} style={[styles.pageContent, { width: SCREEN_WIDTH }]}>
              <Text style={styles.emojiIcon}>{page.icon}</Text>
              <Text style={[styles.title, { color: page.title === 'AnyMarket' ? '#0090ff' : theme.text }]}>{page.title}</Text>
              {page.content(theme, isDark)}
            </View>
          ))}
        </ScrollView>
        
        <View style={styles.footer}>
          {currentPage < PAGES.length - 1 ? (
             <Text style={[styles.swipeHint, { color: theme.textSecondary }]}>Swipe for more →</Text>
          ) : (
             <TouchableOpacity style={[styles.doneButton, { backgroundColor: theme.primary }]} onPress={onClose}>
                <Text style={styles.doneButtonText}>Got it!</Text>
             </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '400',
  },
  indicatorContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pageContent: {
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  emojiIcon: {
    fontSize: 56,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  bodyText: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    fontWeight: '400',
  },
  featureList: {
    marginTop: 40,
    gap: 16,
    width: '100%',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  featureDesc: {
    fontSize: 14,
  },
  infoCard: {
    padding: 20,
    borderRadius: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTag: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  playModeCard: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
  },
  playModeBalance: {
    fontSize: 48,
    fontWeight: '200',
    marginBottom: 4,
  },
  playModeLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 16,
  },
  playModeDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  feeCard: {
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    width: '100%',
  },
  feeHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 20,
  },
  table: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  td: {
    fontSize: 16,
  },
  note: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  swipeHint: {
    fontSize: 14,
    fontWeight: '400',
  },
  doneButton: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  }
});
