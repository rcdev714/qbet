import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuthContext } from "@/contexts/AuthContext";
import { socialService } from "@/services/social.service";

interface SocialFollowContextValue {
  followingCount: number;
  hasFollowing: boolean;
  refreshFollowingCount: () => Promise<void>;
  /** Optimistic follow toggle — also triggers activity feed refresh listeners. */
  onFollowToggled: (isFollowing: boolean) => void;
  /** Ask mounted feeds to reload after privacy or follow changes. */
  refreshActivity: () => void;
  subscribeActivityRefresh: (listener: () => void) => () => void;
}

const SocialFollowContext = createContext<SocialFollowContextValue | null>(null);

export function SocialFollowProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const [followingCount, setFollowingCount] = useState(0);
  const listenersRef = useRef(new Set<() => void>());

  const refreshFollowingCount = useCallback(async () => {
    if (!user) {
      setFollowingCount(0);
      return;
    }
    const stats = await socialService.getFollowStats(user.id);
    setFollowingCount(stats.following);
  }, [user]);

  useEffect(() => {
    void refreshFollowingCount();
  }, [refreshFollowingCount]);

  const notifyActivityRefresh = useCallback(() => {
    listenersRef.current.forEach((listener) => listener());
  }, []);

  const onFollowToggled = useCallback(
    (isFollowing: boolean) => {
      setFollowingCount((prev) => (isFollowing ? prev + 1 : Math.max(0, prev - 1)));
      notifyActivityRefresh();
    },
    [notifyActivityRefresh],
  );

  const subscribeActivityRefresh = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo(
    () => ({
      followingCount,
      hasFollowing: followingCount > 0,
      refreshFollowingCount,
      onFollowToggled,
      refreshActivity: notifyActivityRefresh,
      subscribeActivityRefresh,
    }),
    [followingCount, notifyActivityRefresh, onFollowToggled, refreshFollowingCount, subscribeActivityRefresh],
  );

  return <SocialFollowContext.Provider value={value}>{children}</SocialFollowContext.Provider>;
}

export function useSocialFollow() {
  const context = useContext(SocialFollowContext);
  if (!context) {
    throw new Error("useSocialFollow must be used within SocialFollowProvider");
  }
  return context;
}
