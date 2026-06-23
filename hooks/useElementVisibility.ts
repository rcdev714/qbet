import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";

/**
 * Tracks whether an element is visible in the viewport.
 * Uses IntersectionObserver on web; defaults to visible on native.
 */
export function useElementVisibility(threshold = 0.5): {
  ref: React.RefObject<View | null>;
  isVisible: boolean;
} {
  const ref = useRef<View | null>(null);
  const [isVisible, setIsVisible] = useState(Platform.OS !== "web");

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const node = ref.current as unknown as Element | null;
    if (!node || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry?.isIntersecting ?? false);
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isVisible };
}
