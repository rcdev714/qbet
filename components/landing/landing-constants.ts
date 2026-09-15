export const LANDING_SECTIONS = [
  { id: 'vision', label: 'Vision' },
  { id: 'markets', label: 'Markets' },
  { id: 'group', label: 'Group' },
  { id: 'flow', label: 'Flow' },
  { id: 'join', label: 'Join' },
] as const;

export type LandingSectionId = (typeof LANDING_SECTIONS)[number]['id'];

export const PREMIUM_EASING = {
  outExpo: [0.16, 1, 0.3, 1] as const,
  inOutCubic: [0.65, 0, 0.35, 1] as const,
};

export const SPRING_SNAPPY = { damping: 22, stiffness: 260, mass: 0.8 };
export const SPRING_GENTLE = { damping: 28, stiffness: 180, mass: 1 };
