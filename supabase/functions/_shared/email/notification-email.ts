import { buildBetOutcomeEmail } from "./templates/bet-outcome.ts";
import { buildGroupInviteAcceptedEmail } from "./templates/group-invite-accepted.ts";
import { buildGroupInviteDispatchEmail } from "./templates/group-invite-dispatch.ts";
import { buildMarketResolvedEmail } from "./templates/market-resolved.ts";
import { buildNewFollowerEmail } from "./templates/new-follower.ts";

export type NotificationEmailPayload = {
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  unsubscribeCategory?: "social" | "market_results" | "group_invites";
};

export function buildNotificationEmail(params: {
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  notificationId: string;
  appUrl: string;
}): NotificationEmailPayload | null {
  const data = params.data ?? {};
  const marketId = data.market_id as string | undefined;
  const marketUrl = marketId
    ? `${params.appUrl.replace(/\/$/, "")}/market/${marketId}`
    : params.appUrl;

  switch (params.type) {
    case "bet_won":
    case "bet_lost":
      return {
        ...buildBetOutcomeEmail({
          marketQuestion: (data.market_question as string) ?? params.title,
          won: params.type === "bet_won",
          winningLabel: params.body ?? "Settled",
          marketUrl,
          appUrl: params.appUrl,
          notificationId: params.notificationId,
        }),
        unsubscribeCategory: "market_results",
      };

    case "market_resolved":
      return {
        ...buildMarketResolvedEmail({
          marketQuestion: (data.market_question as string) ?? params.title,
          winningLabel: params.body ?? "Settled",
          isPublic: Boolean(data.is_public),
          marketUrl,
          appUrl: params.appUrl,
          notificationId: params.notificationId,
        }),
        unsubscribeCategory: "market_results",
      };

    case "new_follower": {
      const followerUsername = (data.follower_username as string) ?? "someone";
      const followerId = data.follower_id as string;
      const profileUrl = followerId
        ? `${params.appUrl.replace(/\/$/, "")}/profile/${followerId}`
        : params.appUrl;
      return {
        ...buildNewFollowerEmail({
          followerUsername,
          profileUrl,
          appUrl: params.appUrl,
          notificationId: params.notificationId,
        }),
        unsubscribeCategory: "social",
      };
    }

    case "group_invite": {
      const groupId = data.group_id as string | undefined;
      const groupUrl = groupId
        ? `${params.appUrl.replace(/\/$/, "")}/group/${groupId}`
        : params.appUrl;
      return {
        ...buildGroupInviteDispatchEmail({
          groupName: (data.group_name as string) ?? params.title.replace(/^Invited to /, ""),
          inviterUsername: (data.inviter_username as string) ?? "Someone",
          groupUrl,
          appUrl: params.appUrl,
          notificationId: params.notificationId,
        }),
        unsubscribeCategory: "group_invites",
      };
    }

    case "group_invite_accepted": {
      const groupId = data.group_id as string | undefined;
      const groupUrl = groupId
        ? `${params.appUrl.replace(/\/$/, "")}/group/${groupId}`
        : params.appUrl;
      return {
        ...buildGroupInviteAcceptedEmail({
          memberUsername: (data.member_username as string) ?? "Someone",
          groupName: (data.group_name as string) ?? "your group",
          groupUrl,
          appUrl: params.appUrl,
          notificationId: params.notificationId,
        }),
        unsubscribeCategory: "group_invites",
      };
    }

    case "beta_approved":
      return null;

    default:
      return null;
  }
}

export type NotificationPrefs = {
  email_enabled: boolean;
  email_market_results: boolean;
  email_social: boolean;
  email_group_invites: boolean;
  email_frequency?: string;
  email_skip_if_read?: boolean;
};

export function shouldSendEmailForType(type: string, prefs: NotificationPrefs): boolean {
  if (!prefs.email_enabled) return false;

  if (type === "bet_won" || type === "bet_lost" || type === "market_resolved") {
    return prefs.email_market_results;
  }

  if (type === "new_follower") {
    return prefs.email_social;
  }

  if (type === "group_invite" || type === "group_invite_accepted") {
    return prefs.email_group_invites;
  }

  return false;
}

export function isDigestEligibleType(type: string): boolean {
  return type === "new_follower" || type === "group_invite_accepted";
}

export function shouldSendPushForType(
  type: string,
  prefs: {
    push_web_enabled: boolean;
    push_market_results: boolean;
    push_social: boolean;
  },
): boolean {
  if (!prefs.push_web_enabled) return false;

  if (type === "bet_won" || type === "bet_lost" || type === "market_resolved") {
    return prefs.push_market_results;
  }

  if (type === "new_follower" || type === "group_invite" || type === "group_invite_accepted") {
    return prefs.push_social;
  }

  return false;
}

export async function shouldSuppressOutcomeEmailForContract(
  adminClient: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col2: string, val2: string) => {
            not: (col3: string, op: string, val3: null) => {
              maybeSingle: () => Promise<{ data: unknown }>;
            };
          };
        };
      };
    };
  },
  userId: string,
  marketId: string | undefined,
  type: string,
): Promise<boolean> {
  if ((type !== "bet_won" && type !== "bet_lost") || !marketId) {
    return false;
  }

  const { data } = await adminClient
    .from("bet_contracts")
    .select("id, resolved_email_sent_at, resolved_snapshot")
    .eq("user_id", userId)
    .eq("market_id", marketId)
    .not("resolved_snapshot", "is", null)
    .maybeSingle();

  if (!data) return false;
  return true;
}
