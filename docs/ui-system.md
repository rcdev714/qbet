# Anymarkt UI System

Design contract for platform-wide UI/UX. All feature code in `screens/` and `components/` must follow these rules.

## Tokens

- **Colors:** `useTheme()` — never hardcode hex outside `constants/theme.ts` and `lib/legal/`
- **Typography:** `AppText variant="body|title1|…"` — never inline `fontSize` / `fontWeight`
- **Layout:** `constants/layout.ts` — gutters, breakpoints, section gaps, max-widths
- **Motion:** `constants/motion.ts` — durations, stagger, ceremony tiers

## Primitives (`components/ui/`)

| Need | Component |
|------|-----------|
| Text | `AppText` |
| Page wrapper | `AppScreen` |
| Button | `AppButton` |
| Input / form | `AppInput`, `FieldGroup` |
| Card | `AppCard` + subcomponents |
| Empty | `EmptyState` |
| Error (inline) | `ErrorBanner` |
| Loading | `AppSkeleton`, `AnymarktLoader` (bootstrap only) |
| Header | `ScreenHeader`, `GlobalHeader` |
| Stagger entrance | `StaggerGroup`, `AppReveal` |
| Success moment | `SuccessPulse` |

## States

- **Loading:** skeleton in lists; full-screen loader only for bootstrap/route guards
- **Empty:** `EmptyState` with title + optional CTA
- **Error:** `ErrorBanner` (recoverable) or `showAppAlert` / `showAppAlertRaw`
- **Capture errors:** `captureUiError(error, screen, action)` → Sentry

## Accessibility (WCAG 2.2 AA target)

- Min touch target 44pt — `AppButton`, `AppListRow`
- Web focus ring on all interactives (3px `theme.ring`)
- `accessibilityRole` + `accessibilityLabel` on pressables
- `accessibilityLiveRegion="polite"` on errors
- Honor reduce-motion — `useReduceMotion`, instant fallbacks

## Motion (anticipatory design)

| Tier | Duration | Use |
|------|----------|-----|
| 0 | 0ms | Tabs, filters |
| 1 | 150ms | Button press |
| 2 | 480ms | Premium nav overlay |
| 3 | 600ms | First-visit screen stagger |
| 4 | 720ms+ | Bootstrap, bet success |

Use `useCeremony(key)` to skip repeat visits. Cap list stagger at 8 items.

## Sentry / logging

- `logger.info/warn/error/debug` from `lib/logger.ts`
- Never log PII, tokens, or raw Stripe objects
- `EXPO_PUBLIC_SENTRY_DSN` enables production monitoring
- `EXPO_PUBLIC_SENTRY_DEV=true` enables in development

## i18n

Namespaces: `common`, `errors`, `profile`, `market`, `groups`, `contract`, `landing`, plus existing app namespaces.

Use `useTranslation()` for all user-facing strings.

## Lint guard

```bash
bash scripts/check-ui-tokens.sh
```

Flags hardcoded hex and inline font sizes outside allowed paths.
