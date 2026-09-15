import React from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

type LandingScrollContextValue = {
  scrollY: SharedValue<number>;
  viewportHeight: SharedValue<number>;
  sectionOffsets: SharedValue<Record<string, number>>;
  activeSection: SharedValue<string>;
  registerSection: (id: string, offset: number) => void;
};

const LandingScrollContext = React.createContext<LandingScrollContextValue | null>(null);

export function LandingScrollProvider({
  children,
  viewportHeight,
}: {
  children: React.ReactNode;
  viewportHeight: number;
}) {
  const scrollY = useSharedValue(0);
  const viewportHeightValue = useSharedValue(viewportHeight);
  const sectionOffsets = useSharedValue<Record<string, number>>({});
  const activeSection = useSharedValue('vision');

  React.useEffect(() => {
    viewportHeightValue.value = viewportHeight;
  }, [viewportHeight, viewportHeightValue]);

  const registerSection = React.useCallback(
    (id: string, offset: number) => {
      sectionOffsets.value = { ...sectionOffsets.value, [id]: offset };
    },
    [sectionOffsets],
  );

  const value = React.useMemo(
    () => ({
      scrollY,
      viewportHeight: viewportHeightValue,
      sectionOffsets,
      activeSection,
      registerSection,
    }),
    [scrollY, viewportHeightValue, sectionOffsets, activeSection, registerSection],
  );

  return <LandingScrollContext.Provider value={value}>{children}</LandingScrollContext.Provider>;
}

export function useLandingScroll() {
  const context = React.useContext(LandingScrollContext);
  if (!context) {
    throw new Error('useLandingScroll must be used within LandingScrollProvider');
  }
  return context;
}
