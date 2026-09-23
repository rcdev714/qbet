# Social names and stickers

Expo (qbet) and web (`react-anymarket`) share one name column and one sticker message shape. This app implements both. Web already stores `users.display_name` and `update_own_profile(text, text, text, text)`. It does not yet generate Twitch-style names or render stickers. A later web client can show names and stickers sent from this app without a second format.

Apply `supabase/migrations/20260923201000_social_display_names.sql` on the database the client uses:

| Database | When |
|----------|------|
| `jweyqlcvvmdyyqgqcsjd` | Expo project documented in this repo |
| `ztqunamafyvathalyrxp` | Web production (`anymarkt.com`) |

Do not apply web migration `20260923010000_user_settings_group_admin.sql` onto the Expo database. That file also changes groups, invites, and privacy. Do not run either migration from this agent against production.

## Display names

| Field | Rule |
|-------|------|
| `users.username` | Unique public handle. Existing `users_username_key` stays case-sensitive. Max 32. |
| `users.display_name` | Label shown on the profile, feed, chats, and people lists. Max 80. Not unique, matching web. |
| Shown label | Trimmed display name, otherwise username, otherwise “Someone”. Never an email or email local-part. |
| Signup / missing username | BEFORE INSERT `assign_social_name_on_insert` assigns `AdjectiveNoun##` (for example username `swiftotter42`, display name `SwiftOtter42`). |
| Existing username, blank display name | Copy the username. Do not rename that person. |
| Login safety net | `ensure_social_display_name()` for a signed-in user who still has a blank name. |
| Edit | Settings → Account. Save sends the current username, display name, bio, and avatar together through `update_own_profile`. A null argument clears that field. |
| Collision | The generator skips a candidate that matches `lower(username)` or `lower(display_name)`. Edited display names may repeat. A taken username raises `Username is already taken`. |

`handle_new_auth_user` is unchanged, so new wallets still start at 0 real balance. The insert trigger covers that path and `join_group_by_code` inserting `users(id)`.

Direct `UPDATE` grants on `users` are still only `username` and `avatar_url`. Display name and bio go through the RPC.

Feed RPCs from `20260923190000_social_activity_sharing.sql` return `display_name` after `username` in every branch of `social_activity_query` and in `get_social_feed`, `get_profile_activity`, and `get_following_activity_v2`. Legacy `get_following_activity(int)` keeps its 8-column shape. `list_discoverable_users(int, int)` adds `display_name` after `username` and keeps the Expo directory filters (username present, not `deleted_%`, not the viewer).

## Stickers

Curated emoji packs live in `lib/social/stickers.ts`. There is no custom upload.

| Column | Value |
|--------|--------|
| `message_type` | `sticker` |
| `content` | `sticker:<pack>:<slug>` |

Packs: `odds` (rocket, chart, target, trophy, fire, eyes, clown, coin) and `reactions` (laugh, think, pray, hundred, skull, heart, wave, party).

Both group chat and market chat (the comment thread on a market) send that shape. A known id renders as its emoji, without a text bubble. An unknown `sticker:<pack>:<slug>` still renders as a sticker, so a pack added on the other client does not show up as raw text. Group list previews use the sticker label, never the raw id.

Recent stickers are local (`@anymarkt/recent-stickers` in AsyncStorage), capped at 16, and are not synced.

There is no separate comment composer besides market chat.

## Phone

Sticker targets and the tray close control are at least 44pt. The tray grid wraps from the window width. The tray does not animate, so reduced motion does not need a second path. Display name and username fields sit in Account settings with a wrapping helper, including at 320pt.

## Verify

1. Sign up without a username. The profile shows a generated display name and a matching `@username`.
2. Change the display name in Settings. Feed, profile, follower lists, and chat use the new label. The `@username` stays unless you edit that field.
3. Try a username that already exists. The save reports that it is taken and does not clear the bio or photo.
4. Open a group chat and a market chat. Send a sticker from each pack and one from Recent. The other side sees an emoji, and the group list does not show `sticker:odds:rocket`.
5. A row with `message_type = 'sticker'` and an unknown slug still renders as a sticker.

```bash
npm test
npm run typecheck
npm run lint
```
