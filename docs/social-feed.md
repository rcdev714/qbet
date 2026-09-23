# Social feed and profiles

Expo home is a social stream. Discover and Following share one contract with the web app (`react-anymarket`) and the database the client is pointed at.

| Database | When |
|----------|------|
| `jweyqlcvvmdyyqgqcsjd` | Expo project documented in this repo |
| `ztqunamafyvathalyrxp` | Web production (`anymarkt.com`) |

Apply `supabase/migrations/20260923190000_social_activity_sharing.sql` on the database the running client uses. Do not add a second feed RPC.

Activity rows include `display_name` immediately after `username`. `get_social_feed`, `get_profile_activity`, and `get_following_activity_v2` share that shape. Legacy `get_following_activity(int)` does not. Names and stickers: [social-identity.md](./social-identity.md).

## Semantics

`public.users.show_activity_on_feed` defaults to **true** so people who were already visible to followers stay visible. Turning it off removes that person from Discover and Following only. It does not hide profile sections.

Profile sections are separate columns, also default **true** except the badge:

| Column | Default | Who it affects |
|--------|---------|----------------|
| `show_open_bets` | true | Stranger reads of that person's bets on markets with `status = 'open'` |
| `show_results` | true | Stranger reads of that person's bets on every other market status |
| `show_activity_logs` | true | `get_profile_activity` for everyone except the owner |
| `show_verified_badge` | false | Public badge only when this is on **and** `user_compliance_profiles.kyc_status = 'verified'` |

The owner always sees Settings, KYC status, activity logs, open bets, and results. A public profile omits a section when its toggle is off. There is no locked empty state. The badge is the only identity signal on a public profile: no documents, legal name, email, phone, or provider id.

These flags are separate from `users.is_discoverable` (the people directory) and from `update_own_privacy`. Web home in `react-anymarket` PR 35 still leads with For you / Following market posts. The contract both clients should call is `get_social_feed` plus `get_profile_privacy` / `set_profile_section_privacy`, so a later web client does not invent a second rule.

| Viewer | Feed |
|--------|------|
| Follows nobody | **Discover** — other users who left activity sharing on. Never a blank dead end: if there are no posts, the feed lists people to follow. |
| Follows someone | **Following** — only those people, and only when `show_activity_on_feed` is on. Strangers are not mixed in. If everyone opted out, the list explains that and links to Discover. |
| Opens Discover on purpose | Same Discover stream, including people they follow. |
| Own profile | Settings, KYC status, logs, open bets, and results, even when every public toggle is off. |
| Someone else's profile | Logs, open bets, and results only when that section is on. Followers, following, stats totals, and groups stay. |

Feed RPCs are security definer and still key off `show_activity_on_feed`, so a post can appear in Discover while that same bet is hidden on the profile. The bets SELECT policy is what hides profile rows. Market probability charts and client bet counts that read `bets` will under-count people who turned a section off. Odds still come from `options.total_pool`.

`auto` on `get_social_feed` uses the same rule: Following if `user_follows` has any row for the viewer, otherwise Discover.

Posts are the last 30 days: bets, results, public comments, public markets they posted, and non-DM groups. Private group questions stay redacted unless the viewer is a member. Discover does not list private groups. Someone else's profile lists a group only when it is discoverable or the viewer is a member. Following still includes non-DM groups from people you follow.

## RPCs

| RPC | Who |
|-----|-----|
| `get_social_feed(p_mode, p_limit, p_offset, p_types)` | `discover`, `following`, or `auto` |
| `get_following_activity_v2` | Unchanged signature. Now Following with the flag applied. |
| `get_following_activity` | Legacy bet list. Same flag. |
| `get_profile_activity(p_user_id, p_limit, p_offset)` | Profile timeline. Owner always. Others only when `show_activity_logs` is on |
| `profile_activity_is_visible(p_user_id)` | Same log rule. Used only if `get_profile_privacy` is not deployed yet |
| `set_show_activity_on_feed(p_enabled)` | Feed flag only |
| `get_profile_privacy(p_user_id)` | Owner gets settings plus a KYC status word. Everyone else gets section booleans and `verified_badge` |
| `set_profile_section_privacy(...)` | Writes the four profile flags. Does not change the feed flag |

**Show my activity on the feed** is in Settings → Privacy and on your profile, above the section toggles. Practice mode is unchanged: cards do not move live USD, and the profile does not unlock identity or withdrawals. The owner's KYC row is a status word that links to verification. It does not show documents.

## Verify Discover vs Following

1. Sign in as A with zero follows. Home opens **Discover**. Posts belong to other people who still share activity. With no posts, people to follow still show.
2. Follow B (flag on). Home moves to **Following** unless you already picked a tab. Only B's posts appear. Discover still shows other people.
3. B turns **Show my activity on the feed** off and leaves the profile sections on. A no longer sees B on Following or Discover. A's view of B's profile still shows logs, open bets, and results.
4. B turns off open bets only. A's profile view omits the Open bets tab. Results and logs stay. There is no lock icon and no empty private state for that section.
5. B turns the verified badge off, or is not verified. A sees no badge. A never sees a KYC status, documents, email, or phone on B's profile. B still sees Settings and a verification status word.
6. A unfollows everyone. Home returns to Discover and is not an empty Following list.

Markets remain the third segment for the public board. Guests land there. Signed-in people land on Discover or Following.

## Phone widths

Action row is three 44pt icon buttons (like, comment, share), counts, and a Bet control. It fits, wrapping the Bet control if needed, at:

| Width | Device |
|-------|--------|
| 320pt | iPhone SE |
| 360dp | common Android |
| 390pt | iPhone 14 / 15 |
| 393pt | iPhone 16 |
| 412dp | Pixel-class Android |
| 430pt | iPhone Pro Max |

Profile stats scroll horizontally. Feed and profile-section labels wrap beside the switch and stay at least 44pt tall, including at 320pt. Odds chips are equal-width and at least 44pt tall. Reduced motion skips decorative animation; these rows do not animate in. The verified badge wraps onto the next line next to a long handle.

## Checks

```bash
npm test
npm run typecheck
npm run lint
```

SQL against a local stack that already has the earlier social migrations:

```bash
npx supabase migration up --local
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select public.social_feed_includes_actor('00000000-0000-0000-0000-000000000001', 'discover', null, '00000000-0000-0000-0000-000000000001', true);"
```

The viewer is excluded from Discover even when the flag is on. A followed user with the flag off is excluded from Following.
