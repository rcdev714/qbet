import { supabase } from "@/lib/supabase";
import type { MarketChatMessage, MarketChatMessageInsert } from "@/types/marketChat";
import type {
    MentionBetCard,
    MentionBetResult,
    MentionEmbedPayload,
    MentionGroupCard,
    MentionGroupResult,
    MentionProfileCard,
    MentionUserResult,
} from "@/types/mention";
import {
    mentionPayloadToContent,
    mentionPayloadToMessageType,
} from "@/types/mention";
import type { Message, MessageInsert } from "@/types/message";
import { marketChatService } from "./marketChat.service";
import { messageService } from "./message.service";

function parseJsonRecord<T>(data: unknown): T | null {
  if (!data || typeof data !== "object") return null;
  return data as T;
}

export const mentionService = {
  async searchMentionUsers(
    query: string,
    groupId?: string | null,
    limit = 20,
  ): Promise<MentionUserResult[]> {
    const { data, error } = await (supabase as any).rpc("search_mention_users", {
      p_query: query,
      p_group_id: groupId ?? null,
      p_limit: limit,
    });
    if (error) {
      console.error("[mentionService] searchMentionUsers:", error);
      return [];
    }
    return (data ?? []) as MentionUserResult[];
  },

  async searchMentionGroups(query: string, limit = 20): Promise<MentionGroupResult[]> {
    const { data, error } = await (supabase as any).rpc("search_mention_groups", {
      p_query: query,
      p_limit: limit,
    });
    if (error) {
      console.error("[mentionService] searchMentionGroups:", error);
      return [];
    }
    return (data ?? []) as MentionGroupResult[];
  },

  async searchMentionBets(
    query: string,
    options: { groupId?: string | null; marketId?: string | null },
    limit = 20,
  ): Promise<MentionBetResult[]> {
    const { data, error } = await (supabase as any).rpc("search_mention_bets", {
      p_query: query,
      p_group_id: options.groupId ?? null,
      p_market_id: options.marketId ?? null,
      p_limit: limit,
    });
    if (error) {
      console.error("[mentionService] searchMentionBets:", error);
      return [];
    }
    return (data ?? []) as MentionBetResult[];
  },

  async fetchGroupCard(groupId: string): Promise<MentionGroupCard | null> {
    const { data, error } = await (supabase as any).rpc("get_mention_card_group", {
      p_group_id: groupId,
    });
    if (error) {
      console.error("[mentionService] fetchGroupCard:", error);
      return null;
    }
    return parseJsonRecord<MentionGroupCard>(data);
  },

  async fetchProfileCard(userId: string): Promise<MentionProfileCard | null> {
    const { data, error } = await (supabase as any).rpc("get_mention_card_profile", {
      p_user_id: userId,
    });
    if (error) {
      console.error("[mentionService] fetchProfileCard:", error);
      return null;
    }
    return parseJsonRecord<MentionProfileCard>(data);
  },

  async fetchBetCard(betId: string): Promise<MentionBetCard | null> {
    const { data, error } = await (supabase as any).rpc("get_mention_card_bet", {
      p_bet_id: betId,
    });
    if (error) {
      console.error("[mentionService] fetchBetCard:", error);
      return null;
    }
    return parseJsonRecord<MentionBetCard>(data);
  },

  buildGroupMessageInsert(
    groupId: string,
    userId: string,
    payload: MentionEmbedPayload,
  ): MessageInsert {
    const messageType = mentionPayloadToMessageType(payload.type) as MessageInsert["message_type"];
    return {
      group_id: groupId,
      user_id: userId,
      content: mentionPayloadToContent(payload),
      message_type: messageType,
      referenced_group_id: payload.type === "group" ? payload.groupId : null,
      referenced_user_id: payload.type === "profile" ? payload.userId : null,
      bet_id: payload.type === "bet" ? payload.betId : null,
    };
  },

  buildMarketChatInsert(
    marketId: string,
    userId: string,
    payload: MentionEmbedPayload,
  ): MarketChatMessageInsert {
    const messageType = mentionPayloadToMessageType(payload.type) as MarketChatMessageInsert["message_type"];
    return {
      market_id: marketId,
      user_id: userId,
      content: mentionPayloadToContent(payload),
      message_type: messageType,
      referenced_group_id: payload.type === "group" ? payload.groupId : null,
      referenced_user_id: payload.type === "profile" ? payload.userId : null,
      bet_id: payload.type === "bet" ? payload.betId : null,
    };
  },

  async sendGroupMentionMessage(
    groupId: string,
    userId: string,
    payload: MentionEmbedPayload,
  ): Promise<{ message: Message | null; error: Error | null }> {
    return messageService.sendMessage(this.buildGroupMessageInsert(groupId, userId, payload));
  },

  async sendMarketMentionMessage(
    marketId: string,
    userId: string,
    payload: MentionEmbedPayload,
  ): Promise<{ message: MarketChatMessage | null; error: Error | null }> {
    return marketChatService.sendMentionMessage(
      this.buildMarketChatInsert(marketId, userId, payload),
    );
  },
};
