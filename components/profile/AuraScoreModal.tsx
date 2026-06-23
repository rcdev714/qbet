import { ModalHeader } from "@/components/ui/ModalHeader";
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React from 'react';
import {
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface AuraScoreModalProps {
  isVisible: boolean;
  onClose: () => void;
  winRate: number;
}



const LEVELS = [
  { name: 'Noob', min: 0, max: 10, icon: 'egg-outline', description: 'Just starting your journey into the unknown.' },
  { name: 'Light Seeker', min: 10, max: 30, icon: 'flashlight-outline', description: 'Searching for the truth behind the odds.' },
  { name: 'Enlightened', min: 30, max: 60, icon: 'sunny-outline', description: 'The fog of uncertainty begins to clear.' },
  { name: 'Oracle', min: 60, max: 80, icon: 'infinite-outline', description: 'The future is your plaything. A true master of destiny.' },
  { name: 'Eye of Ra', min: 80, max: 100, icon: 'eye-outline', description: 'You see what others miss. The divine gaze is upon you.' },
];

export function AuraScoreModal({ isVisible, onClose, winRate }: AuraScoreModalProps) {
  const { theme, isDark } = useTheme();
  const ratePercent = winRate * 100;

  const currentLevelIndex = LEVELS.findIndex(l => ratePercent >= l.min && ratePercent < l.max);
  const currentLevel = currentLevelIndex === -1 ? LEVELS[LEVELS.length - 1] : LEVELS[currentLevelIndex];
  
  const nextLevel = currentLevelIndex < LEVELS.length - 1 ? LEVELS[currentLevelIndex + 1] : null;
  const progressToNext = nextLevel ? ((ratePercent - currentLevel.min) / (currentLevel.max - currentLevel.min)) * 100 : 100;

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={isDark ? 'dark' : 'light'}>
        <SafeAreaView style={styles.safeArea}>
          <View style={[styles.container, { backgroundColor: theme.background }]}>
            <ModalHeader title="Aura Score" onClose={onClose} closeLabel="Close" />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.auraContainer}>
                <View style={[styles.auraCircle, { borderColor: theme.primary }]}>
                   <Ionicons name={currentLevel.icon as any} size={60} color={theme.primary} />
                </View>
                <Text style={[styles.levelName, { color: theme.text }]}>{currentLevel.name}</Text>
                <Text style={[styles.winRateText, { color: theme.primary }]}>{ratePercent.toFixed(1)}% Win Rate (Aura)</Text>
                <Text style={[styles.description, { color: theme.textSecondary }]}>{currentLevel.description}</Text>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                   <Text style={[styles.progressTitle, { color: theme.textSecondary }]}>Level Progress</Text>
                   {nextLevel && <Text style={[styles.nextLevelLabel, { color: theme.textSecondary }]}>Next: {nextLevel.name}</Text>}
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: theme.border }]}>
                  <View style={[styles.progressBarFill, { width: `${Math.max(5, progressToNext)}%`, backgroundColor: theme.primary }]} />
                </View>
              </View>

              <View style={styles.levelsList}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Aura Tiers</Text>
                {LEVELS.map((level, index) => {
                  const isActive = index === currentLevelIndex;
                  return (
                    <View key={level.name} style={[styles.levelRow, isActive && { backgroundColor: theme.surface, borderRadius: 12, padding: 12 }]}>
                      <Ionicons 
                        name={level.icon as any} 
                        size={24} 
                        color={isActive ? theme.primary : theme.textSecondary} 
                        style={styles.levelIcon}
                      />
                      <View style={styles.levelInfo}>
                        <Text style={[styles.levelRowName, { color: isActive ? theme.text : theme.textSecondary }]}>
                            {level.name}
                        </Text>
                        <Text style={[styles.levelRange, { color: theme.textSecondary }]}>
                            {level.min}-{level.max}% Win Rate
                        </Text>
                      </View>
                      {isActive && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                    </View>
                  );
                })}
              </View>

              <View style={[styles.footer, { backgroundColor: theme.surface }]}>
                 <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
                 <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                    Your Aura represents your historical Win Rate. Higher accuracy grants divine status and unlocks new mythological tiers.
                 </Text>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150,150,150,0.1)',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    padding: 4,
  },
  scrollContent: {
    padding: 24,
  },
  auraContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  auraCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  levelName: {
    fontSize: 32,
    fontWeight: '400',
    letterSpacing: -1,
    marginBottom: 4,
  },
  winRateText: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  progressSection: {
    marginBottom: 32,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
  nextLevelLabel: {
    fontSize: 12,
    fontWeight: '400',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  levelsList: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '400',
    marginBottom: 16,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  levelIcon: {
    width: 40,
  },
  levelInfo: {
    flex: 1,
  },
  levelRowName: {
    fontSize: 16,
    fontWeight: '400',
  },
  levelRange: {
    fontSize: 12,
  },
  footer: {
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    flex: 1,
    marginLeft: 12,
    lineHeight: 16,
  },
});
