import { buildBetOutcomeEmail } from "./templates/bet-outcome.ts";
import { buildMarketResolvedEmail } from "./templates/market-resolved.ts";
import { buildNewFollowerEmail } from "./templates/new-follower.ts";

export type NotificationEmailPayload = {
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
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
      return buildBetOutcomeEmail({
        marketQuestion: (data.market_question as string) ?? params.title,
        won: params.type === "bet_won",
        winningLabel: params.body ?? "Settled",
        marketUrl,
        appUrl: params.appUrl,
        notificationId: params.notificationId,
      });

    case "market_resolved":
      return buildMarketResolvedEmail({
        marketQuestion: (data.market_question as string) ?? params.title,
        winningLabel: params.body ?? "Settled",
        isPublic: Boolean(data.is_public),
        marketUrl,
        appUrl: params.appUrl,
        notificationId: params.notificationId,
      });

    case "new_follower": {
      const followerUsername = (data.follower_username as string) ?? "someone";
      const followerId = data.follower_id as string;
      const profileUrl = followerId
        ? `${params.appUrl.replace(/\/$/, "")}/profile/${followerId}`
        : params.appUrl;
      return buildNewFollowerEmail({
        followerUsername,
        profileUrl,
        appUrl: params.appUrl,
        notificationId: params.notificationId,
      });
    }

    case "beta_approved":
      return null;

    default:
      return null;
  }
}

export function shouldSendEmailForType(
  type: string,
  prefs: {
    email_enabled: boolean;
    email_market_results: boolean;
    email_social: boolean;
  },
): boolean {
  if (!prefs.email_enabled) return false;

  if (type === "bet_won" || type === "bet_lost" || type === "market_resolved") {
    return prefs.email_market_results;
  }

  if (type === "new_follower" || type === "group_invite" || type === "group_invite_accepted") {
    return prefs.email_social;
  }

  return false;
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
