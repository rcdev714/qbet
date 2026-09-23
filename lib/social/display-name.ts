/**
 * Public social name. Matches web `users.display_name` plus unique `username`.
 *
 * The shown label is the display name. The @handle stays the unique username.
 * Signup assigns a Twitch-style AdjectiveNoun## pair when either is missing.
 * `update_own_profile(text, text, text, text)` is the shared write.
 */

export const DISPLAY_NAME_MAX = 80;
export const USERNAME_MAX = 32;

export const SOCIAL_NAME_ADJECTIVES = [
  "swift",
  "lucky",
  "bold",
  "calm",
  "keen",
  "vivid",
  "brave",
  "witty",
  "merry",
  "noble",
  "rapid",
  "solar",
  "golden",
  "quiet",
  "bright",
  "clever",
  "mighty",
  "nimble",
  "steady",
  "wild",
  "cozy",
  "epic",
  "cosmic",
  "silver",
] as const;

export const SOCIAL_NAME_NOUNS = [
  "otter",
  "falcon",
  "panda",
  "comet",
  "fox",
  "heron",
  "maple",
  "nova",
  "pebble",
  "robin",
  "cedar",
  "lynx",
  "orca",
  "quartz",
  "raven",
  "sage",
  "tiger",
  "willow",
  "badger",
  "crane",
  "dolphin",
  "ember",
  "gecko",
  "ibis",
] as const;

export function socialLabel(input: {
  displayName?: string | null;
  username?: string | null;
  fallback?: string;
}): string {
  const displayName = input.displayName?.trim();
  if (displayName) return displayName;
  const username = input.username?.trim();
  if (username) return username;
  return input.fallback ?? "Someone";
}

export function socialHandle(username?: string | null): string | null {
  const handle = username?.trim();
  if (!handle) return null;
  return `@${handle}`;
}

function titleWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** AdjectiveNoun## . Username is the lowercase form and stays within 32 characters. */
export function randomSocialName(rng: () => number = Math.random): {
  username: string;
  displayName: string;
} {
  const adjective =
    SOCIAL_NAME_ADJECTIVES[Math.floor(rng() * SOCIAL_NAME_ADJECTIVES.length)] ?? "swift";
  const noun = SOCIAL_NAME_NOUNS[Math.floor(rng() * SOCIAL_NAME_NOUNS.length)] ?? "otter";
  const number = 10 + Math.floor(rng() * 90);
  const username = `${adjective}${noun}${number}`.slice(0, USERNAME_MAX);
  const displayName = `${titleWord(adjective)}${titleWord(noun)}${number}`.slice(0, DISPLAY_NAME_MAX);
  return { username, displayName };
}

export function normalizeDisplayName(value: string): string {
  return value.trim().slice(0, DISPLAY_NAME_MAX);
}

export function normalizeUsername(value: string): string {
  return value.trim().slice(0, USERNAME_MAX);
}
