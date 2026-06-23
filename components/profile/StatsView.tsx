import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { formatCurrency } from "../../lib/parimutuel";
import { BetWithDetails } from "../../types/market";
import { StatsChart } from "./StatsChart";

interface StatsViewProps {
  stats: {
    totalWagered: number;
    totalWon: number;
    bestWin: number;
    averageBet: number;
  };
  bets: BetWithDetails[];
}

export function StatsView({ stats, bets }: StatsViewProps) {
  const { theme } = useTheme();

  const StatCard = ({ label, value, color, icon }: { label: string, value: string, color?: string, icon: keyof typeof Ionicons.glyphMap }) => (
      <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
          <View style={styles.statHeader}>
              <Ionicons name={icon} size={16} color={color || theme.textSecondary} />
              <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
          </View>
          <Text style={[styles.value, { color: color || theme.text }]}>{value}</Text>
      </View>
  );

  return (
    <View style={styles.container}>
      <StatsChart bets={bets} />
      
      <View style={styles.grid}>
        <StatCard 
            label="Total Wagered" 
            value={formatCurrency(stats.totalWagered)} 
            icon="wallet-outline"
        />
        <StatCard 
            label="Total Won" 
            value={formatCurrency(stats.totalWon)} 
            color={theme.success}
            icon="trending-up-outline"
        />
        <StatCard 
            label="Best Win" 
            value={formatCurrency(stats.bestWin)} 
            icon="trophy-outline"
        />
        <StatCard 
            label="Avg. Bet" 
            value={formatCurrency(stats.averageBet)} 
            icon="analytics-outline"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 60,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  statCard: {
    width: '45%',
    flexGrow: 1,
    margin: 8,
    padding: 16,
    borderRadius: 20,
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '400',
    textTransform: 'uppercase',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: -0.5,
  },
});
