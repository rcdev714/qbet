/**
 * Shared Discover / Following rules for Expo and the web app.
 *
 * - No follows: the feed is Discover (other people who turned activity sharing on).
 * - Has follows: Following shows only those people, and only when their
 *   `show_activity_on_feed` flag is on.
 * - The viewer never sees their own posts in either feed. Own activity stays
 *   on the profile, even when the flag is off.
 * - Discover can include people the viewer follows. Following never includes
 *   strangers.
 */

export type SocialFeedMode = "discover" | "following";
export type SocialFeedRequest = SocialFeedMode | "auto";

export interface ResolvedSocialFeed {
  mode: SocialFeedMode;
  /** Following was requested, but the viewer follows nobody, so Discover is shown. */
  coercedFromFollowing: boolean;
}

export function resolveSocialFeedMode(input: {
  requested: SocialFeedRequest;
  followingCount: number;
}): ResolvedSocialFeed {
  const followingCount = Number.isFinite(input.followingCount)
    ? Math.max(0, Math.floor(input.followingCount))
    : 0;

  if (input.requested === "discover") {
    return { mode: "discover", coercedFromFollowing: false };
  }

  if (followingCount === 0) {
    return {
      mode: "discover",
      coercedFromFollowing: input.requested === "following",
    };
  }

  return { mode: "following", coercedFromFollowing: false };
}

export function profileActivityVisibleToViewer(input: {
  isOwner: boolean;
  showActivityOnFeed: boolean;
}): boolean {
  return input.isOwner || input.showActivityOnFeed;
}

export function includeActorInFeed(input: {
  mode: SocialFeedMode;
  viewerId: string;
  actorId: string;
  showActivityOnFeed: boolean;
  viewerFollowsActor: boolean;
}): boolean {
  if (!input.actorId || input.actorId === input.viewerId) return false;
  if (!input.showActivityOnFeed) return false;
  if (input.mode === "following") return input.viewerFollowsActor;
  return true;
}

/** Phone widths the action row must fit: icon targets plus a Bet control. */
export function socialFeedActionRowFits(screenWidth: number): boolean {
  const horizontalPadding = 16 * 2;
  const iconButtons = 3 * 44;
  const betButton = 72;
  const gaps = 3 * 8;
  return screenWidth - horizontalPadding >= iconButtons + betButton + gaps;
}

export function isMissingRpcError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883" || error.code === "42703") {
    return true;
  }
  return /could not find the function|does not exist|schema cache/i.test(error.message ?? "");
}
