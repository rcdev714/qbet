import type { Database } from "./database";
import type { Market } from "./market";
import type { User } from "./user";

export type MessageType = 'text' | 'market';

// Message status for delivery indicators
// 'sending' = Optimistic message, not yet saved to server (shows single gray check)
// 'sent' = Saved to server (shows single check ✓)
// 'delivered' = Visible to other members (shows double check ✓✓)
export type MessageStatus = 'sending' | 'sent' | 'delivered';

export interface Message {
  id: string;
  group_id: string;
  user_id: string;
  content: string | null;
  message_type: MessageType;
  market_id: string | null;
  created_at: string;
  // Client-side status for UI (not stored in DB)
  status?: MessageStatus;
  // Joined fields
  user?: User;
  market?: Market;
}

export type MessageInsert = {
  group_id: string;
  user_id: string;
  content?: string | null;
  message_type?: MessageType;
  market_id?: string | null;
};

