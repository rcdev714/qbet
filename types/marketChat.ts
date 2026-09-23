import type { MarketChatMessageType } from "./mention";

export type { MarketChatMessageType };

export interface MarketChatMessage {
  id: string;
  market_id: string;
  user_id: string;
  content: string;
  message_type: MarketChatMessageType;
  referenced_group_id?: string | null;
  referenced_user_id?: string | null;
  bet_id?: string | null;
  created_at: string;
  user?: {
    id: string;
    username: string | null;
    display_name?: string | null;
    email: string | null;
    avatar_url: string | null;
  };
}

export type MarketChatMessageInsert = {
  market_id: string;
  user_id: string;
  content?: string;
  message_type?: MarketChatMessageType;
  referenced_group_id?: string | null;
  referenced_user_id?: string | null;
  bet_id?: string | null;
};
