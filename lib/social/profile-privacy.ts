/**
 * Public profile sections. The owner always sees settings, KYC status,
 * activity logs, open bets, and results. Everyone else sees a section only
 * when that setting is on. A hidden section is omitted, not shown as locked.
 *
 * Discover and Following stay on `show_activity_on_feed` and are not these flags.
 * The verified badge is the only identity signal on a public profile.
 */

export type ProfileSection =
  | "settings"
  | "kyc_status"
  | "activity_logs"
  | "open_bets"
  | "results";

export interface ProfileSectionFlags {
  show_open_bets: boolean;
  show_results: boolean;
  show_activity_logs: boolean;
}

export interface ProfilePrivacySettings extends ProfileSectionFlags {
  show_activity_on_feed: boolean;
  show_verified_badge: boolean;
}

export interface ProfileSections {
  settings: boolean;
  kyc_status: boolean;
  activity_logs: boolean;
  open_bets: boolean;
  results: boolean;
}

export interface ProfilePrivacyView {
  isOwner: boolean;
  verifiedBadge: boolean;
  /** Owner only. Never a document, legal name, or provider id. */
  kycStatus: string | null;
  settings: ProfilePrivacySettings | null;
  sections: ProfileSections;
}

const OWNER_SECTIONS: ProfileSections = {
  settings: true,
  kyc_status: true,
  activity_logs: true,
  open_bets: true,
  results: true,
};

export function profileSectionVisible(input: {
  isOwner: boolean;
  section: ProfileSection;
  flags: ProfileSectionFlags;
}): boolean {
  if (input.isOwner) return true;
  if (input.section === "settings" || input.section === "kyc_status") return false;
  if (input.section === "open_bets") return input.flags.show_open_bets;
  if (input.section === "results") return input.flags.show_results;
  return input.flags.show_activity_logs;
}

export function publicVerifiedBadge(input: {
  showVerifiedBadge: boolean;
  kycStatus: string | null | undefined;
}): boolean {
  return input.showVerifiedBadge && input.kycStatus === "verified";
}

export function ownerProfileSections(): ProfileSections {
  return { ...OWNER_SECTIONS };
}

/** Before the privacy RPC exists, other profiles follow the single activity flag. */
export function legacyPublicSections(activityVisible: boolean): ProfileSections {
  return {
    settings: false,
    kyc_status: false,
    activity_logs: activityVisible,
    open_bets: activityVisible,
    results: activityVisible,
  };
}

const HIDDEN_PUBLIC: ProfileSections = {
  settings: false,
  kyc_status: false,
  activity_logs: false,
  open_bets: false,
  results: false,
};

/** Strangers start here until `get_profile_privacy` returns. */
export function hiddenPublicSections(): ProfileSections {
  return { ...HIDDEN_PUBLIC };
}

/**
 * Owner always gets every section. A real privacy payload wins for strangers.
 * A missing RPC falls back to the single legacy activity flag. Any other
 * failure stays hidden so bets are not fetched.
 */
export function resolveProfileSections(input: {
  isOwner: boolean;
  privacy: ProfilePrivacyView | null;
  missing: boolean;
  legacyActivityVisible: boolean;
}): ProfileSections {
  if (input.isOwner) return ownerProfileSections();
  if (input.privacy) {
    return {
      settings: false,
      kyc_status: false,
      activity_logs: input.privacy.sections.activity_logs,
      open_bets: input.privacy.sections.open_bets,
      results: input.privacy.sections.results,
    };
  }
  if (input.missing) return legacyPublicSections(input.legacyActivityVisible);
  return hiddenPublicSections();
}

export const PROFILE_TAB_ORDER = ["activity", "stats", "groups", "open", "closed"] as const;
export type ProfileContentTab = (typeof PROFILE_TAB_ORDER)[number];

/** Hidden sections are omitted. Stats and groups stay; they do not list bet rows. */
export function visibleProfileTabs(sections: ProfileSections): ProfileContentTab[] {
  return PROFILE_TAB_ORDER.filter((tab) => {
    if (tab === "activity") return sections.activity_logs;
    if (tab === "open") return sections.open_bets;
    if (tab === "closed") return sections.results;
    return true;
  });
}

export function coerceProfileTab(
  active: ProfileContentTab,
  visible: readonly ProfileContentTab[],
): ProfileContentTab {
  if (visible.includes(active)) return active;
  return visible[0] ?? "stats";
}

export function includeBetOnProfile(
  marketStatus: string | null | undefined,
  sections: Pick<ProfileSections, "open_bets" | "results">,
): boolean {
  if (marketStatus === "open") return sections.open_bets;
  return sections.results;
}

export function profileMoneyVisible(
  sections: Pick<ProfileSections, "open_bets" | "results">,
): boolean {
  return sections.open_bets || sections.results;
}

/** Status word for the owner. Never a document, legal name, or provider id. */
export function kycStatusLabelKey(
  status: string | null | undefined,
): "statusVerified" | "statusPending" | "statusNotVerified" | "statusNeedsReview" {
  if (status === "verified") return "statusVerified";
  if (status === "pending") return "statusPending";
  if (status == null || status === "not_started") return "statusNotVerified";
  return "statusNeedsReview";
}

function readBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

export function parseProfilePrivacy(data: unknown): ProfilePrivacyView | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const isOwner = row.is_owner === true;
  const sectionsRaw = row.sections;
  if (!sectionsRaw || typeof sectionsRaw !== "object") return null;
  const sections = sectionsRaw as Record<string, unknown>;
  const settingsRaw = row.settings;
  const settings =
    settingsRaw && typeof settingsRaw === "object"
      ? (settingsRaw as Record<string, unknown>)
      : null;

  return {
    isOwner,
    verifiedBadge: readBool(row.verified_badge, false),
    kycStatus: isOwner && typeof row.kyc_status === "string" ? row.kyc_status : null,
    settings:
      isOwner && settings
        ? {
            show_activity_on_feed: readBool(settings.show_activity_on_feed, true),
            show_open_bets: readBool(settings.show_open_bets, true),
            show_results: readBool(settings.show_results, true),
            show_activity_logs: readBool(settings.show_activity_logs, true),
            show_verified_badge: readBool(settings.show_verified_badge, false),
          }
        : null,
    sections: {
      settings: isOwner || readBool(sections.settings, false),
      kyc_status: isOwner || readBool(sections.kyc_status, false),
      activity_logs: isOwner || readBool(sections.activity_logs, false),
      open_bets: isOwner || readBool(sections.open_bets, false),
      results: isOwner || readBool(sections.results, false),
    },
  };
}
