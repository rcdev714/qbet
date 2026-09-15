# Anymarkt UI System

Design contract for platform-wide UI/UX. All feature code in `screens/` and `components/` must follow these rules.

---

## Component Consistency Contract

**Rule #1:** Use primitives from `components/ui/`. Never duplicate typography, button, input, radius, or page-shell styling in feature code.

| Layer | Responsibility |
|-------|----------------|
| Tokens | `useTheme()`, `constants/typography.ts`, `constants/layout.ts`, `constants/motion.ts` |
| Primitives | `AppText`, `AppButton`, `AppInput`, `AppScreen`, `AppCard`, `AppListRow`, … |
| Patterns | `EmptyState`, `ScreenHeader`, `FieldGroup`, `ModalHeader`, `ErrorBanner` |
| Features | Domain logic in `components/<domain>/` — compose patterns only |
| Screens | Thin wrappers: data + `AppScreen` shell — no inline styles |

**Exempt paths** (separate visual language): `components/landing/`, `app/index.tsx` (marketing hero), `lib/legal/`.

**Deprecated:** `components/themed-text.tsx` — migrate to `AppText`. Do not use in new code.

---

## Canonical Spec

One allowed value per property. No numeric literals for typography, radius, or button dimensions in feature code.

### Typography — `AppText` only

| Variant | Size / LH | Weight | Use |
|---------|-----------|--------|-----|
| `display` | 28 / 34 | 400 | Marketing hero only |
| `title1` | 22 / 28 | 400 | Screen title |
| `title2` | 18 / 24 | 400 | Section title, card title |
| `title3` | 16 / 22 | 400 | Subsection |
| `body` | 15 / 22 | 400 | Default copy |
| `bodySm` | 14 / 20 | 400 | Secondary copy |
| `label` | 13 / 18 | 400 | Form labels |
| `caption` | 12 / 16 | 400 | Meta, timestamps |
| `mono` | 14 / 20 | mono | Codes, amounts |

**Forbidden:** inline `fontSize`, `fontWeight` in screens/components (except `AppBadge` via `FontWeight.semibold`).

### Buttons — `AppButton` / `AppIconButton` only

| Size | minHeight | paddingX | Use |
|------|-----------|----------|-----|
| `sm` | 40 | 12 | Inline actions |
| `md` | 50 | 16 | **Default** — forms, modals, CTAs |
| `lg` | 56 | 20 | Single primary hero CTA |

| Variant | Use |
|---------|-----|
| `primary` | One filled primary action per viewport |
| `secondary` | Secondary action |
| `ghost` | Tertiary / low-emphasis |
| `destructive` | Irreversible actions — always confirm first |

**Forbidden:** custom `TouchableOpacity` with button-like background/border for actions. Use `SegmentedControl` / `FilterChipBar` for toggles.

### Inputs — `AppInput` + `FieldGroup`

| Property | Value |
|----------|-------|
| minHeight | 48 |
| borderRadius | `theme.radius.sm` (10) |
| fontSize | 15 (`body`) |
| field gap | `SECTION_GAP_MD` (20) via `FieldGroup` |
| variants | `default` (product UI), `onDark` (login/marketing forms on dark surfaces) |

**Forbidden:** raw `TextInput` in `screens/` or route files.

### Border radius — `theme.radius.*` only

| Token | px | Use |
|-------|-----|-----|
| `sm` | 10 | Inputs, small chips |
| `md` | 14 | Buttons, list rows, cards |
| `lg` | 16 | Modals, large cards |
| `xl` | 24 | Bottom sheets, hero cards |
| `pill` | 999 | Badges, avatars, tags |

**Forbidden:** numeric `borderRadius` literals (8, 12, 18, 20, 22, etc.) in feature code.

### Page shells — `AppScreen` + `ScreenHeader`

```tsx
<AppScreen scroll columnVariant="social" padBottomForTabBar>
  <ScreenHeader title="..." />
  {/* content */}
</AppScreen>
```

| `columnVariant` | max-width | Use |
|-----------------|-----------|-----|
| `social` | 630px | Feed, profile, DMs |
| `standard` | 720px | Forms, settings, detail |
| `wide` | 1120px | Admin, data-heavy |

**Forbidden:** `SafeAreaView` + manual padding in screens.

---

## Design Principles

Premium UX follows predictable interaction design. Priority order:

1. **Consistency & standards** — same control looks and behaves the same everywhere (primitives only)
2. **Visibility of system status** — loading, empty, error, success always explicit
3. **User-centered design** — every screen answers who, what, what next
4. **Error prevention & recovery** — confirm destructive actions; human-readable errors
5. **Recognition over recall** — persistent nav, visible labels
6. **Trust (financial flows)** — confirm amounts/fees before irreversible wallet actions
7. **Accessibility by default** — WCAG 2.2 AA, reduce motion, 44pt targets
8. **Aesthetic minimalism** — regular (400) weight for titles; semibold only in badges/CTA labels
9. **Flexibility** — desktop shortcuts without blocking mobile simplicity
10. **Motion with purpose** — clarify state changes, never decorate

---

## Composition Rules

### Mandatory

- All user-facing strings via `useTranslation()`
- All colors via `useTheme()` — no hex outside `constants/theme.ts`, `ThemeContext`, `lib/legal/`
- Tappable list items → `AppListRow`
- Elevated surfaces → `AppCard`
- Modals → `ModalHeader` + title; dismiss visible
- Errors → `ErrorBanner` (inline) or `showAppAlert` (blocking)
- Loading lists → `AppSkeleton`; bootstrap only → `AnymarktLoader`

### Forbidden in `screens/` and product `components/`

- Raw `<Text>` — use `AppText`
- Raw `<TextInput>` — use `AppInput`
- Button-like `<TouchableOpacity>` — use `AppButton` or `AppIconButton`
- Inline `fontSize`, `fontWeight`, `borderRadius` literals
- `ThemedText` from `components/themed-text.tsx`

### Allowed exceptions

- `components/landing/**`, `app/index.tsx` — `Marketing` tokens
- `components/ui/**` — primitive implementations
- `lib/legal/**` — legal document typography
- Charts, third-party wrappers where primitives cannot apply

---

## Primitives (`components/ui/`)

| Need | Component |
|------|-----------|
| Text | `AppText` |
| Page wrapper | `AppScreen` |
| Button | `AppButton` |
| Icon button | `AppIconButton` |
| Input / form | `AppInput`, `FieldGroup` |
| Card | `AppCard` + subcomponents |
| List row | `AppListRow` |
| Empty | `EmptyState` |
| Error (inline) | `ErrorBanner` |
| Loading | `AppSkeleton`, `AnymarktLoader` (bootstrap only) |
| Header | `ScreenHeader`, `ModalHeader`, `GlobalHeader` |
| Toggles | `SegmentedControl`, `FilterChipBar` |
| Stagger entrance | `StaggerGroup`, `AppReveal` |
| Success moment | `SuccessPulse` |

---

## States

- **Loading:** skeleton in lists; full-screen loader only for bootstrap/route guards
- **Empty:** `EmptyState` with title + optional CTA
- **Error:** `ErrorBanner` (recoverable) or `showAppAlert` / `showAppAlertRaw`
- **Success:** `SuccessPulse` + optional haptic on native
- **Capture errors:** `captureUiError(error, screen, action)` → Sentry

### Feedback loop

1. Press → immediate opacity feedback (`ACTIVE_OPACITY`)
2. If action >300ms → loading state within 100ms
3. Outcome → success pulse/toast OR inline error with recovery
4. UI reflects new state without manual refresh

---

## Layout & Hierarchy

- **Gutters:** `resolveGutter(width)` — 16 mobile, 24 tablet, 32 desktop
- **Section gaps:** `SECTION_GAP_SM` (12) within groups; `SECTION_GAP_MD` (20) between groups; `SECTION_GAP_LG` (32) between major sections
- **One primary action** per viewport — at most one filled `AppButton` primary without scroll
- **Nested radii:** parent radius ≈ child radius + padding (concentric feel)

---

## Motion (anticipatory design)

| Tier | Duration | Use |
|------|----------|-----|
| 0 | 0ms | Tabs, filters |
| 1 | 150ms | Button press |
| 2 | 280ms | `AppReveal`, item entrance |
| 3 | 480ms | Premium nav overlay |
| 4 | 600ms | First-visit screen stagger |
| 5 | 720ms+ | Bootstrap, bet success |

Use `useCeremony(key)` to skip repeat visits. Cap list stagger at 8 items (`STAGGER_MAX_ITEMS`). Honor `useReduceMotion()` — instant opacity, no translate.

| Transition | Component |
|------------|-----------|
| Stack push (native) | slide |
| Stack push (web) | fade |
| Heavy route | `PremiumNavigationProvider` overlay |
| Success | `SuccessPulse` |

---

## Accessibility (WCAG 2.2 AA target)

- Min touch target 44pt — `AppButton` md/lg, `AppIconButton`, `AppListRow`
- Web focus ring on all interactives (3px `theme.ring`)
- `accessibilityRole` + `accessibilityLabel` on pressables
- `accessibilityLiveRegion="polite"` on errors
- Honor reduce-motion — `useReduceMotion`, instant fallbacks
- Never encode state by color alone — pair with icon/label
- Web: `cursor: pointer` on clickables; Enter submits forms; Escape closes modals

---

## Web-specific

- Desktop ≥900px: left sidebar; mobile: bottom tab bar
- Content centering via `WebContentColumn` + `AppScreen` `columnVariant`
- **Master-detail (Groups):** at `DESKTOP_BREAKPOINT` (900px), the Groups tab uses a WhatsApp-style split: fixed **360px** list pane (`GROUPS_LIST_PANE_WIDTH`) + flexible detail pane. Routes live under `app/(tabs)/groups/` (`index` = placeholder, `[id]` = embedded `GroupScreen`). Mobile/narrow web keeps stack navigation (`groups/index` → `groups/[id]`). Deep links to `/group/[id]` redirect into the split route on desktop.
- Hover: subtle background on list rows (web only)
- Reserve skeleton space to prevent layout shift

---

## Migration Status

Phased migration from ad-hoc styles to primitives. Update this table as files are migrated.

### Phase 1 — Core screens

| File | Status |
|------|--------|
| `screens/HomeScreen.tsx` | migrated |
| `screens/GroupScreen.tsx` | migrated |
| `screens/MarketScreen.tsx` | migrated |

### Phase 2 — Money + auth

| File | Status |
|------|--------|
| `screens/TopUpScreen.tsx` | migrated |
| `screens/WalletScreen.tsx` | migrated |
| `app/login.tsx` | migrated |
| `components/CreateGroupModal.tsx` | migrated |
| `components/profile/SettingsModal.tsx` | migrated |
| `components/GroupInfoModal.tsx` | migrated |

### Phase 3 — Feature components (priority)

| File | Status |
|------|--------|
| `components/AdminFeedManager.tsx` | migrated |
| `components/FeedMarketCard.tsx` | migrated |
| `components/MarketCard.tsx` | migrated |
| `components/PlayModeToggle.tsx` | migrated |

### Violation inventory (baseline audit)

| Signal | Approx. count | Resolution |
|--------|---------------|------------|
| Inline `fontSize` | ~90 files | Replace with `AppText` variant |
| Inline `borderRadius` | ~85 files | Replace with `theme.radius.*` |
| Raw `TouchableOpacity` buttons | ~90 files | Replace with `AppButton` / `AppIconButton` |
| `AppButton` adoption | ~25 files | Expand via migration |
| `AppScreen` in screens | 6 / 15 | Wrap all screens |
| `FieldGroup` usage | 2 routes | All forms use `FieldGroup` |

---

## Lint & CI

```bash
bash scripts/check-ui-tokens.sh
```

Enforces rules on **migrated paths** listed in `scripts/ui-lint-enforced-paths.txt`. Add a file to that list when its migration is complete.

Checks on enforced paths:

- Hardcoded hex colors
- Inline `fontSize` / non-token `fontWeight`
- Inline `borderRadius` numeric literals
- Raw `<Text>` and `<TextInput>` in screens/routes

Allowlist for exempt paths: `scripts/ui-lint-allowlist.txt` (marketing, legal, primitives, landing).

When migrating a file: fix violations → add path to `ui-lint-enforced-paths.txt` → update Migration Status table below.

---

## Tokens

- **Colors:** `useTheme()` — never hardcode hex outside token files
- **Typography:** `AppText variant="…"` — see Canonical Spec
- **Layout:** `constants/layout.ts`
- **Motion:** `constants/motion.ts`

## Sentry / logging

- `logger.info/warn/error/debug` from `lib/logger.ts`
- Never log PII, tokens, or raw Stripe objects
- `EXPO_PUBLIC_SENTRY_DSN` enables production monitoring
- `EXPO_PUBLIC_SENTRY_DEV=true` enables in development

## i18n

Namespaces: `common`, `errors`, `profile`, `market`, `groups`, `contract`, `landing`, plus existing app namespaces.

Use `useTranslation()` for all user-facing strings.
