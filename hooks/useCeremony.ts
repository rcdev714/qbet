import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const CEREMONY_PREFIX = "anymarket.ceremony.";

export function useCeremony(key: string): { shouldAnimate: boolean; markSeen: () => void } {
  const storageKey = `${CEREMONY_PREFIX}${key}`;
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey)
      .then((seen) => {
        if (!mounted) return;
        setShouldAnimate(seen !== "1");
        setReady(true);
      })
      .catch(() => {
        if (mounted) {
          setShouldAnimate(true);
          setReady(true);
        }
      });
    return () => {
      mounted = false;
    };
  }, [storageKey]);

  const markSeen = useCallback(() => {
    setShouldAnimate(false);
    AsyncStorage.setItem(storageKey, "1").catch(() => {});
  }, [storageKey]);

  return { shouldAnimate: ready && shouldAnimate, markSeen };
}
