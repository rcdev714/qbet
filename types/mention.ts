export type MentionEntityType = "group" | "profile" | "bet";

export type MarketChatMessageType =
  | "text"
  | "shared_group"
  | "shared_profile"
  | "shared_bet"
  | "sticker";

export type MentionEmbedPayload =
  | { type: "group"; groupId: string }
  | { type: "profile"; userId: string }
  | { type: "bet"; betId: string };

export type MentionUserResult = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  is_group_member: boolean;
};

export type MentionGroupResult = {
  group_id: string;
  name: string | null;
  avatar_url: string | null;
  member_count: number;
  is_discoverable: boolean;
  is_member: boolean;
};

export type MentionBetResult = {
  bet_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  market_id: string;
  market_question: string | null;
  market_image_url: string | null;
  amount: number;
  side: string | null;
};

export type MentionGroupCard = {
  group_id: string;
  name: string | null;
  avatar_url: string | null;
  member_count: number;
  is_discoverable: boolean;
  is_member: boolean;
  invite_code: string | null;
};

export type MentionProfileCard = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  followers_count: number;
  win_rate: number;
};

export type MentionBetCard = {
  bet_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  market_id: string;
  market_question: string | null;
  market_image_url: string | null;
  amount: number;
  side: string | null;
};

export function mentionPayloadToMessageType(type: MentionEntityType): string {
  switch (type) {
    case "group":
      return "shared_group";
    case "profile":
      return "shared_profile";
    case "bet":
      return "shared_bet";
  }
}

export function mentionPayloadToContent(payload: MentionEmbedPayload): string {
  switch (payload.type) {
    case "group":
      return "Shared a group";
    case "profile":
      return "Shared a profile";
    case "bet":
      return "Shared a bet";
  }
}
