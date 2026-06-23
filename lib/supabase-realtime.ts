import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "./supabase";

/**
 * Supabase reuses channel instances by topic. Calling `.on()` after a prior
 * `.subscribe()` on the same topic throws. Always remove stale channels first.
 */
export function removeChannelByName(channelName: string) {
  const topics = new Set([channelName, `realtime:${channelName}`]);

  for (const channel of supabase.getChannels()) {
    if (channel.topic && topics.has(channel.topic)) {
      void supabase.removeChannel(channel);
    }
  }
}

export function createPostgresChannel(channelName: string) {
  removeChannelByName(channelName);
  return supabase.channel(channelName);
}

export async function teardownChannel(channel: RealtimeChannel) {
  await supabase.removeChannel(channel);
}
