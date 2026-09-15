/**
 * PostgREST relationship embed strings with explicit FK hints.
 *
 * When a table has more than one foreign key to the same related table,
 * bare embeds like `users(*)` or `creator:users(...)` fail with PGRST201.
 * Always use `relation!foreign_key_name` — see types/database.ts Relationships.
 *
 * @see supabase/migrations/20260630130000_chat_mention_embeds.sql
 */

const CREATOR_FIELDS = "username, avatar_url";

export const MARKET_WITH_CREATOR_SELECT = `*, creator:users!markets_creator_id_fkey(${CREATOR_FIELDS})`;

export const GROUP_MEMBERS_WITH_USER_SELECT = `*, users:users!group_members_user_id_fkey(*)`;

export const GROUP_MEMBERS_WITH_GROUP_SELECT = `
  group_id,
  groups!group_members_group_id_fkey (id,name,description,admin_id,created_at,avatar_url)
`;

export const BET_WITH_MARKET_AND_OPTION_SELECT =
  "*, markets!bets_market_id_fkey(*), options!bets_option_matches_market_fkey(*)";

export const MESSAGE_SELECT = `
  *,
  user:users!messages_user_id_fkey(*),
  market:markets!messages_market_id_fkey(*)
`;

export const MARKET_CHAT_USER_SELECT = `
  id,
  username,
  email,
  avatar_url
`;

export const MARKET_CHAT_MESSAGE_SELECT = `
  *,
  user:users!market_chat_messages_user_id_fkey (${MARKET_CHAT_USER_SELECT})
`;

export const USER_FOLLOWS_FOLLOWER_SELECT = `
  created_at,
  follower:users!user_follows_follower_id_fkey (
    id,
    username,
    avatar_url
  )
`;

export const BETS_WITH_USER_SELECT = `
  id,
  user_id,
  option_id,
  amount,
  placed_at,
  user:users!bets_user_id_fkey (
    username,
    email
  )
`;
