# Group create and join

Phone sheets for creating a group and joining with an invite code. The data rules match the web app. The layout does not copy the web groups page, which is still a dense name / description / code form.

Apply `supabase/migrations/20260923210000_group_join_preview.sql` on the database the client uses:

| Database | When |
|----------|------|
| `jweyqlcvvmdyyqgqcsjd` | Expo project documented in this repo |
| `ztqunamafyvathalyrxp` | Web production (`anymarkt.com`), only if that database should share this join behavior |

Do not apply web migration `20260923010000_user_settings_group_admin.sql` onto the Expo database. Do not run this migration from an agent against production.

## Create

`CreateGroupSheet` is four steps: name, optional photo, privacy, optional blurb. One step is on screen at a time.

| Step | Stored as |
|------|-----------|
| Name | `groups.name` (required, trimmed, max 48) |
| Photo | Uploaded to the `avatars` bucket under `group-avatars/{groupId}/…`, then `groups.avatar_url` |
| On my profile | Leave `is_discoverable` and `show_on_profile` at their default `true`. `join_group_from_profile` can add a member in one tap. |
| Invite only | `update_group_visibility` sets both flags to `false`. The group stays off profiles. People join with the code. |
| Blurb | `groups.description`, omitted when blank (max 160) |

The creator row in `group_members` stays `role = 'admin'`. A failed photo or privacy save leaves the group in place and says so. Invite-only that fails to save stays listed, which is the column default.

Expo has no `groups.visibility` column. Web's middle state (listed, but join only by code) is not a third choice here. Profile listing is both flags on. Invite only is both flags off.

## Join

`JoinGroupSheet` takes the 6-character share code (`generate_group_code` is 6 hex digits, matched case-insensitively).

`groups` SELECT is member-or-admin, so the client cannot read a group it has not joined. `preview_group_by_code(text)` is security definer and returns name, description, avatar, member count, whether the caller is already a member, and `is_discoverable`. It does not return `share_code`. An unknown code returns no row. A signed-out caller is rejected.

| Card | What the button does |
|------|----------------------|
| Looking up | No join button |
| Unknown code | Explains the code does not match. No join button |
| Lookup failed | Try again. Does not join blind |
| Preview RPC missing | One Join button, same as before the preview existed |
| Not a member | Preview card and one Join button |
| Already a member | Same card and Open group. Does not insert again |

`join_group_by_code` still inserts `users(id)` and a wallet at real balance `0`. On an existing `(group_id, user_id)` it does nothing and returns the current row, so an admin who enters the code is not demoted to member. RLS policies are unchanged.

The same sheets replace the inline code fields on Home, the groups list, group admin, and the profile join panel.

## Phone

Targets are at least 44pt (continue, join, privacy cards, header icon buttons). Invite cells share the row width so six cells fit at 320pt. The sheet uses the system page transition and does not add its own animation.

Widths to check: 320, 360, 390, 393, 412, 430.

## Verify

1. Create a group: name, skip photo, choose invite only, skip the blurb. You are the admin. The group is not listed for one-tap profile join.
2. Create another with a photo and "On my profile". The photo shows, and another account can join from the profile.
3. Enter a bad code. The sheet says it does not match and does not show Join.
4. Enter a real code. The card shows the name before Join.
5. Enter a code for a group you already admin. The button opens the group and your role stays admin.
6. Repeat in Spanish. The sheet strings come from `groups.json`.

```bash
npm test
npm run typecheck
npm run lint
```
