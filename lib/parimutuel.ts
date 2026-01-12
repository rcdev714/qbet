import type { MarketOption } from "../types/market";

/**
 * Parimutuel Pool Mathematics
 * 
 * The parimutuel system pools all bets together and distributes proportionally to winners.
 * Zero operator risk - all money comes from and goes to participants.
 */

export interface ImpliedOdds {
  optionId: string;
  probability: number; // 0-1
  pool: number;
}

export interface PayoutCalculation {
  userBet: number;
  optionPool: number;
  totalPool: number;
  payoutMultiplier: number;
  potentialPayout: number;
  potentialProfit: number;
}

/**
 * Calculate implied odds (probability) for each option based on pool sizes
 * @param options Array of options with their total_pool values
 * @returns Array of implied odds for each option
 */
export function calculateImpliedOdds(options: MarketOption[]): ImpliedOdds[] {
  const totalPool = options.reduce((sum, opt) => sum + Number(opt.total_pool), 0);

  if (totalPool === 0) {
    // If no bets yet, return equal probability for all options
    const equalProb = 1 / options.length;
    return options.map((opt) => ({
      optionId: opt.id,
      probability: equalProb,
      pool: Number(opt.total_pool),
    }));
  }

  return options.map((opt) => ({
    optionId: opt.id,
    probability: Number(opt.total_pool) / totalPool,
    pool: Number(opt.total_pool),
  }));
}

/**
 * Calculate the total pool across all options
 * @param options Array of options with their total_pool values
 * @returns Total pool amount
 */
export function calculateTotalPool(options: MarketOption[]): number {
  return options.reduce((sum, opt) => sum + Number(opt.total_pool), 0);
}

/**
 * Calculate potential payout for a bet amount
 * @param betAmount Amount user wants to bet
 * @param optionPool Current pool for the option being bet on
 * @param totalPool Total pool across all options
 * @returns Payout calculation details
 */
export function calculatePotentialPayout(
  betAmount: number,
  optionPool: number,
  totalPool: number,
  vig: number = 0.0795
): PayoutCalculation {
  const newOptionPool = optionPool + betAmount;
  const newTotalPool = totalPool + betAmount;

  // Apply vig to the total pool available for distribution
  const poolAfterVig = newTotalPool * (1 - vig);

  // Payout multiplier = Post-Vig Total Pool / Winning Option Pool
  const payoutMultiplier = poolAfterVig / newOptionPool;
  const potentialPayout = betAmount * payoutMultiplier;
  const potentialProfit = potentialPayout - betAmount;

  return {
    userBet: betAmount,
    optionPool: newOptionPool,
    totalPool: newTotalPool,
    payoutMultiplier,
    potentialPayout,
    potentialProfit,
  };
}

/**
 * Calculate payout multiplier for a winning option
 * @param totalPool Total pool across all options
 * @param winningPool Pool for the winning option
 * @param vig House edge (0-1), default 0
 * @returns Payout multiplier
 */
export function calculatePayoutMultiplier(
  totalPool: number,
  winningPool: number,
  vig: number = 0.0795
): number {
  if (winningPool === 0) {
    return 0; // No bets on winning option = no payout
  }
  const poolAfterVig = totalPool * (1 - vig);
  return poolAfterVig / winningPool;
}

/**
 * Calculate payout for a specific bet after market resolution
 * @param userBetAmount Amount the user bet
 * @param winningOptionPool Total pool for the winning option
 * @param totalPool Total pool across all options
 * @param vig House edge (0-1), default 0
 * @returns Payout amount (what user receives)
 */
export function calculateBetPayout(
  userBetAmount: number,
  winningOptionPool: number,
  totalPool: number,
  vig: number = 0.0795
): number {
  if (winningOptionPool === 0) {
    return 0;
  }

  // Apply vig to the total pool
  const poolAfterVig = totalPool * (1 - vig);

  // User's share of the winning pool * total pool (after vig)
  const userShare = userBetAmount / winningOptionPool;
  return userShare * poolAfterVig;
}

/**
 * Distribute winnings to all bets on the winning option
 * @param bets Array of bets on the winning option
 * @param totalPool Total pool across all options
 * @returns Map of bet ID to payout amount
 */
export function distributeWinnings(
  bets: Array<{ id: string; amount: number }>,
  totalPool: number
): Map<string, number> {
  const winningPool = bets.reduce((sum, bet) => sum + Number(bet.amount), 0);
  const payouts = new Map<string, number>();

  if (winningPool === 0) {
    return payouts; // No bets to pay out
  }

  bets.forEach((bet) => {
    const payout = calculateBetPayout(
      Number(bet.amount),
      winningPool,
      totalPool
    );
    payouts.set(bet.id, payout);
  });

  return payouts;
}

/**
 * Format probability as percentage string
 * @param probability Probability value (0-1)
 * @param decimals Number of decimal places
 * @returns Formatted percentage string (e.g., "60.5%")
 */
export function formatProbability(
  probability: number,
  decimals: number = 1
): string {
  return `${(probability * 100).toFixed(decimals)}%`;
}

/**
 * Format currency amount
 * @param amount Amount to format
 * @param currency Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

