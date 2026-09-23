# Social feed and profiles

Expo home is a social stream. Discover and Following share one contract with the web app (`react-anymarket`) and the database the client is pointed at.

| Database | When |
|----------|------|
| `jweyqlcvvmdyyqgqcsjd` | Expo project documented in this repo |
| `ztqunamafyvathalyrxp` | Web production (`anymarkt.com`) |

Apply `supabase/migrations/20260923190000_social_activity_sharing.sql` on the database the running client uses. Do not add a second feed RPC.

## Semantics

`public.users.show_activity_on_feed` defaults to **true** so people who were already visible to followers stay visible. Turning it off removes that person from Discover, Following, and stranger reads of their public-market bets. Their own profile still shows their activity.

This flag is separate from `users.is_discoverable` (the people directory) and from `update_own_privacy`. Web home in `react-anymarket` PR 35 still leads with For you / Following market posts. The activity contract both clients should call is `get_social_feed` plus this column, so a later web client does not invent a second rule.

| Viewer | Feed |
|--------|------|
| Follows nobody | **Discover** — other users who left activity sharing on. Never a blank dead end: if there are no posts, the feed lists people to follow. |
| Follows someone | **Following** — only those people, and only when their flag is on. Strangers are not mixed in. If everyone opted out, the list explains that and links to Discover. |
| Opens Discover on purpose | Same Discover stream, including people they follow. |
| Own profile | Activity tab always, even when the flag is off. |
| Someone else's profile | Activity, open bets, and history only when that person shares activity. Followers and following lists stay available. |

`auto` on `get_social_feed` uses the same rule: Following if `user_follows` has any row for the viewer, otherwise Discover.

Posts are the last 30 days: bets, results, public comments, public markets they posted, and non-DM groups. Private group questions stay redacted unless the viewer is a member. Discover does not list private groups. Someone else's profile lists a group only when it is discoverable or the viewer is a member. Following still includes non-DM groups from people you follow.

## RPCs

| RPC | Who |
|-----|-----|
| `get_social_feed(p_mode, p_limit, p_offset, p_types)` | `discover`, `following`, or `auto` |
| `get_following_activity_v2` | Unchanged signature. Now Following with the flag applied. |
| `get_following_activity` | Legacy bet list. Same flag. |
| `get_profile_activity(p_user_id, p_limit, p_offset)` | Profile timeline |
| `profile_activity_is_visible(p_user_id)` | Owner is always true |
| `set_show_activity_on_feed(p_enabled)` | Only client write for the flag |

The setting is labeled **Show my activity on the feed** in Settings → Privacy and on your profile. Practice mode is unchanged: cards do not move live USD, identity, or withdrawals.

## Verify Discover vs Following

1. Sign in as A with zero follows. Home opens **Discover**. Posts belong to other people who still share activity. With no posts, people to follow still show.
2. Follow B (flag on). Home moves to **Following** unless you already picked a tab. Only B's posts appear. Discover still shows other people.
3. B turns the setting off. A no longer sees B on Following or Discover. B's profile still shows B's activity. A's view of B's profile says activity is private, including open bets and history.
4. A unfollows everyone. Home returns to Discover and is not an empty Following list.

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

Profile stats scroll horizontally. The activity toggle label wraps beside the switch. Odds chips are equal-width and at least 44pt tall. Reduced motion skips decorative animation; these rows do not animate in.

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
