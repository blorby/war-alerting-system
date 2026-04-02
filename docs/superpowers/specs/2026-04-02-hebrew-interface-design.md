# Hebrew Interface Support — Design Spec

## Overview

Add Hebrew as the default UI language with a lightweight, Zustand-based i18n system. Text-only RTL — no layout mirroring. English available via a persistent toggle.

## Architecture

### Translation Infrastructure

- **Store**: Add `locale` field to existing Zustand store with `persist` middleware (localStorage key: `"war-alert-locale"`, default: `"he"`)
- **Dictionaries**: Flat JSON files at `src/lib/i18n/messages/en.json` and `he.json` using dot-notation keys (e.g. `"header.live"`, `"alertFeed.title"`)
- **Hook**: `useT()` in `src/lib/i18n/useT.ts` — reads `locale` from Zustand store, returns `t(key)` function that looks up the key in the active dictionary
- **HTML attributes**: `<html lang="he" dir="rtl">` or `<html lang="en" dir="ltr">` driven by locale state. SSR uses cookie fallback, hydration syncs with store.

### Language Toggle

- Replaces the currently disabled "EN" button in Header.tsx
- Displays "EN" when Hebrew is active, "עב" when English is active (clicking switches to the other)
- Calls `setLocale()` on the Zustand store
- Persistent via localStorage — survives page reloads and sessions

## Translation Scope

### Fully Translated to Hebrew

All UI chrome — labels, buttons, status indicators, empty states, relative time strings, aria-labels, modal content:

| Category | Example Keys |
|----------|-------------|
| Header | `header.live`, `header.threat`, `header.suggestSource`, `header.edit` |
| Alert Feed | `alertFeed.title`, `alertFeed.critical`, `alertFeed.moderate`, `alertFeed.info`, `alertFeed.cleared`, `alertFeed.confirmed`, `alertFeed.singleSrc`, `alertFeed.empty` |
| Threat Panel | `threatPanel.title`, `threatPanel.escalating`, `threatPanel.deEscalating`, `threatPanel.stable`, `threatPanel.awaiting` |
| Timeline Bar | `timeline.live`, `timeline.window`, `timeline.speed`, `timeline.ranges.*`, `timeline.liveWindows.*`, playback aria-labels |
| Bottom Panels | `newsPanel.title`, `socialPanel.title`, `missilePanel.title`, tab labels, empty states, badge labels |
| Filters | `filters.all`, front names (see geographic mix below) |
| Keyboard Shortcuts | `shortcuts.title`, all action descriptions |
| Relative Time | `time.justNow`, `time.minutesAgo`, `time.hoursAgo`, `time.daysAgo`, `time.lessThanMinute` |

### Geographic/Military Terms — Mixed Approach

Well-known conflict zone names translated to Hebrew:
- Gaza → עזה
- Lebanon → לבנון
- West Bank → יהודה ושומרון
- Iran → איראן
- Internal → פנימי

Technical/military event types stay in English: Strike, Thermal, Seismic, Flight, Ship, Missile.

### Stays in English

- Map labels (country names, city names rendered on MapLibre)
- Technical identifiers and codes

### Date/Time Formatting

- Replace hardcoded `"en-US"` locale strings with locale-aware values (`"he-IL"` or `"en-US"`)
- Relative time strings ("Xm ago") use translated templates from the dictionary

## Component Changes

### Infrastructure Files (new/modified)

| File | Change |
|------|--------|
| `src/lib/i18n/messages/en.json` | New — English translation dictionary |
| `src/lib/i18n/messages/he.json` | New — Hebrew translation dictionary |
| `src/lib/i18n/useT.ts` | New — `useT()` hook |
| `src/lib/store.ts` | Add `locale` and `setLocale` to store with persist |
| `src/app/layout.tsx` | Dynamic `lang` and `dir` on `<html>` |
| `src/app/globals.css` | Minimal `[dir="rtl"]` rules for text alignment where needed |

### Component Files (modified — string replacement only)

All ~25 component files get `t()` calls replacing hardcoded strings. No structural, layout, or styling changes:

- `src/components/layout/Header.tsx` — toggle + translated strings
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/AnnouncementBanner.tsx`
- `src/components/layout/NewsTicker.tsx`
- `src/components/layout/KeyboardShortcuts.tsx`
- `src/components/alerts/AlertFeed.tsx`
- `src/components/threats/ThreatPanel.tsx`
- `src/components/timeline/TimelineBar.tsx`
- `src/components/panels/BottomPanels.tsx`
- `src/components/panels/NewsFeedPanel.tsx`
- `src/components/panels/SocialMonitorPanel.tsx`
- `src/components/panels/MissileCountsPanel.tsx`
- `src/components/filters/FrontFilter.tsx`
- `src/components/filters/TypeFilter.tsx`
- `src/components/map/MapContainer.tsx` (date/time locale only)
- `src/components/map/MapLegend.tsx`
- `src/app/page.tsx`

### Constants

`src/lib/constants.ts` labels remain as English keys. Components resolve display labels via `t()`:

```typescript
// Before
<span>{eventType.label}</span>

// After  
<span>{t(`eventTypes.${eventType.value}`)}</span>
```

## CSS Changes

Minimal `[dir="rtl"]` scoped rules — only where text alignment looks wrong without them. No layout mirroring, no flexbox direction changes, no sidebar repositioning.

## What This Does NOT Include

- No layout mirroring or structural RTL changes
- No SSR-first locale detection (client-side Zustand + cookie fallback)
- No additional languages beyond English and Hebrew
- No changes to map rendering or map labels
- No next-intl usage (remains unused, can be removed as dead dependency)
