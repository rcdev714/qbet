import { useEffect, useRef } from "react";
import type React from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Generic hook for managing real-time subscriptions
 * Automatically cleans up subscriptions on unmount
 */
export function useRealtime(
  subscribe: () => RealtimeChannel | null,
  dependencies: React.DependencyList = []
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const channel = subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, dependencies);

  return channelRef.current;
}

