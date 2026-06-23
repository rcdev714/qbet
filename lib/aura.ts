export const AURA_LEVELS = [
  { name: "Noob", min: 0, max: 10 },
  { name: "Light Seeker", min: 10, max: 30 },
  { name: "Enlightened", min: 30, max: 60 },
  { name: "Oracle", min: 60, max: 80 },
  { name: "Eye of Ra", min: 80, max: 100 },
] as const;

export function getAuraTier(winRate: number | null | undefined) {
  const ratePercent = (winRate ?? 0) <= 1 ? (winRate ?? 0) * 100 : (winRate ?? 0);
  const idx = AURA_LEVELS.findIndex((l) => ratePercent >= l.min && ratePercent < l.max);
  return idx === -1 ? AURA_LEVELS[AURA_LEVELS.length - 1] : AURA_LEVELS[idx];
}
