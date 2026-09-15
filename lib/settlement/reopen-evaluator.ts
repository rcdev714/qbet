/**
 * Statistical reopen evaluator for group market settlements.
 *
 * Problem: a flat rule like "reopen if >70% rate unfair" is unsafe — 3/4 unfair (75%)
 * looks strong but has almost no statistical confidence, while 21/30 unfair (70%) is
 * much more meaningful. We therefore combine:
 *
 * 1. Wilson score lower bound (frequentist) — confidence interval on the true unfair rate
 * 2. Beta-Binomial tail probability (Bayesian) — P(true unfair rate > 70% | ratings)
 * 3. Group-size scaling — minimum sample size and participation gates
 * 4. Collusion guard — block auto-reopen when half+ of votes are flagged
 *
 * Reference: https://www.evanmiller.org/how-not-to-sort-by-average-rating.html
 */

export type ReopenDecision =
  | "none"
  | "review"
  | "reopen_candidate"
  | "collusion_blocked";

export type ReopenEvaluatorInput = {
  /** Distinct users who placed a bet on this market (denominator for participation). */
  eligibleBettors: number;
  /** Decisive "unfair" ratings (downvotes). */
  downvotes: number;
  /** Decisive "fair" ratings (upvotes). Neutral/unclear ratings are excluded. */
  upvotes: number;
  /** Ratings removed or down-weighted by collusion heuristics. */
  collusionExcluded: number;
  /** Mature-group target unfair proportion (default 0.70). */
  baseUnfairThreshold?: number;
  /** Min fraction of eligible bettors who must rate (default 0.40). */
  participationMin?: number;
  /** Min posterior P(unfair > threshold) for Bayesian confirmation (default 0.95). */
  bayesianReopenProbability?: number;
  /** Z-score for Wilson interval (1.96 ≈ 95% confidence). */
  confidenceZ?: number;
};

export type ReopenEvaluatorResult = {
  decision: ReopenDecision;
  nDecisive: number;
  nMin: number;
  participation: number;
  pHat: number;
  wilsonLower: number;
  threshold: number;
  bayesianUnfairProb: number;
  collusionExcluded: number;
};

/** Target unfair share once the group has enough ratings (≈70%). */
const DEFAULT_BASE_THRESHOLD = 0.7;
/** At least 40% of bettors must weigh in before we evaluate reopen. */
const DEFAULT_PARTICIPATION_MIN = 0.4;
/** Bayesian gate: require 95% posterior belief that unfair rate exceeds threshold. */
const DEFAULT_BAYESIAN_PROB = 0.95;
/** 95% two-sided normal critical value for Wilson interval. */
const DEFAULT_Z = 1.96;

/**
 * Minimum decisive ratings before evaluation.
 *
 * Formula: n_min = max(3, ⌈√eligible⌉)
 *
 * - Floor of 3 avoids acting on one or two angry bettors.
 * - √eligible grows slowly with group size (3→3, 25→5, 100→10) so larger groups
 *   need more ratings but not linearly (avoids requiring 100% participation).
 */
export function computeNMin(eligibleBettors: number): number {
  return Math.max(3, Math.ceil(Math.sqrt(Math.max(eligibleBettors, 1))));
}

/**
 * Dynamic unfair-rate bar for Wilson comparison.
 *
 * Formula: threshold(n) = base − 0.15 · e^(−n/10)
 *
 * Small n → lower bar (need stronger observed unfairness to reopen):
 *   n=3  → ~0.59, n=10 → ~0.65, n=30+ → ~0.69 (approaches base 0.70)
 *
 * Intuition: with few ratings, raw p̂ is noisy; we only reopen when the Wilson
 * lower bound clears a relaxed but still conservative hurdle.
 */
export function computeReopenThreshold(
  nDecisive: number,
  baseThreshold = DEFAULT_BASE_THRESHOLD,
): number {
  return baseThreshold - 0.15 * Math.exp(-nDecisive / 10);
}

/**
 * Wilson score lower bound on a Bernoulli proportion (unfair rate).
 *
 * Given observed unfair share p̂ = downvotes / n and sample size n, returns the
 * lower end of a confidence interval for the *true* unfair rate p:
 *
 *   LB = [ p̂ + z²/(2n) − z · √((p̂(1−p̂) + z²/(4n)) / n) ] / (1 + z²/n)
 *
 * where z = 1.96 for ~95% confidence (Wilson, 1927).
 *
 * We compare LB to threshold(n), not raw p̂ — so 3/3 unfair (p̂=1) still has a
 * wide interval, while 27/30 unfair has LB ≈ 0.74 and strong evidence.
 */
export function wilsonLowerBound(
  pHat: number,
  n: number,
  z = DEFAULT_Z,
): number {
  if (n <= 0) return 0;
  const z2 = z * z;
  const numerator =
    pHat +
    z2 / (2 * n) -
    z * Math.sqrt((pHat * (1 - pHat) + z2 / (4 * n)) / n);
  const denominator = 1 + z2 / n;
  return Math.max(0, numerator / denominator);
}

/** Log-gamma for Beta normalizing constant (Lanczos approximation). */
function lgamma(z: number): number {
  const g = 7;
  const coef = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343178681049,
    -0.13857109526572012, 9.984369578019571e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  }
  z -= 1;
  let x = coef[0];
  for (let i = 1; i < g + 2; i++) x += coef[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Beta function B(a,b) = Γ(a)Γ(b)/Γ(a+b). */
function betaFunction(a: number, b: number): number {
  return Math.exp(lgamma(a) + lgamma(b) - lgamma(a + b));
}

/**
 * P(X > x0) for X ~ Beta(a, b), computed by trapezoidal integration on [x0, 1].
 *
 * PDF: f(x) ∝ x^(a−1) · (1−x)^(b−1)
 */
function betaTailProbability(a: number, b: number, x0: number): number {
  if (x0 >= 1) return 0;
  const steps = 120;
  let sum = 0;
  for (let i = 1; i <= steps; i++) {
    const lo = x0 + ((1 - x0) * (i - 1)) / steps;
    const hi = x0 + ((1 - x0) * i) / steps;
    const fLo = Math.pow(lo, a - 1) * Math.pow(1 - lo, b - 1);
    const fHi = Math.pow(hi, a - 1) * Math.pow(1 - hi, b - 1);
    sum += ((fLo + fHi) / 2) * (hi - lo);
  }
  return sum / betaFunction(a, b);
}

/**
 * Bayesian confirmation: P(true unfair rate > target | data).
 *
 * Model: true unfair rate p ~ Beta(a, b) with conjugate prior from counts:
 *   a = 1 + unfairCount   (Jeffreys-style +1 pseudo-count)
 *   b = 1 + fairCount
 *
 * Returns ∫_{target}^{1} Beta(a,b)(x) dx — probability the latent unfair share
 * exceeds the reopen target (default 70%). Used as a second gate alongside Wilson
 * so a single method cannot trigger reopen alone (except unanimous unfair).
 */
export function bayesianUnfairProbability(
  unfairCount: number,
  fairCount: number,
  targetUnfair = DEFAULT_BASE_THRESHOLD,
): number {
  const a = 1 + unfairCount;
  const b = 1 + fairCount;
  return betaTailProbability(a, b, targetUnfair);
}

/**
 * Map star score + fairness label to binary vote for reopen math.
 * Neutral (score 3 / "unclear") votes are excluded from n.
 */
export function classifyRating(
  score: number,
  fairness: "fair" | "unclear" | "unfair",
): "downvote" | "upvote" | "neutral" {
  if (fairness === "unfair" || score <= 2) return "downvote";
  if (fairness === "fair" || score >= 4) return "upvote";
  return "neutral";
}

/**
 * Main reopen decision.
 *
 * Pipeline:
 * 1. Gate on n_decisive ≥ n_min and participation ≥ 40%
 * 2. If ≥50% of decisive votes collusion-flagged → collusion_blocked (manual review)
 * 3. Wilson: LB(p̂) > threshold(n) → frequentist evidence of high unfair rate
 * 4. Bayesian: P(p > 70%) ≥ 95% → posterior confirmation
 * 5. Unanimous unfair (all decisive votes down, p̂=1, n ≥ n_min) → reopen_candidate
 *    (Wilson LB is conservative at p̂=1 for tiny n; unanimity is explicit signal)
 *
 * Outcomes:
 * - reopen_candidate: both statistical gates pass, or unanimous unfair
 * - review: Wilson only (platform/group admin should confirm)
 * - none: insufficient data or weak signal
 */
export function evaluateReopen(input: ReopenEvaluatorInput): ReopenEvaluatorResult {
  const {
    eligibleBettors,
    downvotes,
    upvotes,
    collusionExcluded,
    baseUnfairThreshold = DEFAULT_BASE_THRESHOLD,
    participationMin = DEFAULT_PARTICIPATION_MIN,
    bayesianReopenProbability = DEFAULT_BAYESIAN_PROB,
    confidenceZ = DEFAULT_Z,
  } = input;

  const nDecisive = downvotes + upvotes;
  const nMin = computeNMin(eligibleBettors);
  const participation =
    eligibleBettors > 0 ? nDecisive / eligibleBettors : 0;
  const pHat = nDecisive > 0 ? downvotes / nDecisive : 0;
  const threshold = computeReopenThreshold(nDecisive, baseUnfairThreshold);
  const wilsonLower = wilsonLowerBound(pHat, nDecisive, confidenceZ);
  const bayesianProb = bayesianUnfairProbability(downvotes, upvotes, baseUnfairThreshold);

  const base: ReopenEvaluatorResult = {
    decision: "none",
    nDecisive,
    nMin,
    participation,
    pHat,
    wilsonLower,
    threshold,
    bayesianUnfairProb: bayesianProb,
    collusionExcluded,
  };

  if (nDecisive < nMin || participation < participationMin) {
    return base;
  }

  if (collusionExcluded > 0 && collusionExcluded >= Math.ceil(nDecisive * 0.5)) {
    return { ...base, decision: "collusion_blocked" };
  }

  const unanimousUnfair = upvotes === 0 && downvotes >= nMin && pHat === 1;
  const wilsonTriggers = wilsonLower > threshold;
  const bayesianTriggers =
    bayesianProb >= bayesianReopenProbability || unanimousUnfair;

  if ((wilsonTriggers && bayesianTriggers) || unanimousUnfair) {
    return { ...base, decision: "reopen_candidate" };
  }
  if (wilsonTriggers) {
    return { ...base, decision: "review" };
  }

  return base;
}

/** UI risk bucket derived from evaluator decision. */
export function reopenRiskLevel(
  result: ReopenEvaluatorResult,
): "low" | "medium" | "high" {
  if (result.decision === "reopen_candidate" || result.decision === "collusion_blocked") {
    return "high";
  }
  if (result.decision === "review") return "medium";
  return "low";
}
