# Missing Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the local war-alerting-system to feature parity with the public iwm.diskin.net by adding bottom panels, AI assessments, flight tracker, social monitor, prediction markets, functional playback, alert sounds, announcement banners, keyboard shortcuts, and UX improvements.

**Architecture:** The existing app is a Next.js 16 + React 19 + Zustand + MapLibre dashboard. We add a resizable bottom panel system below the map, new API endpoints for missing data, new Zustand store slices for new state, and new UI components. All new panels share a `PanelContainer` wrapper with minimize/maximize. New data comes from existing DB tables (events already have news/social/flight types) plus new API endpoints that query and shape them.

**Tech Stack:** Next.js 16, React 19, Zustand 5, MapLibre GL, Recharts (already installed), Tailwind CSS v4, Drizzle ORM, PostgreSQL

---

## File Structure

### New Files
```
src/components/panels/PanelContainer.tsx      — Shared panel wrapper with minimize/maximize/title
src/components/panels/BottomPanels.tsx         — Bottom panel grid layout
src/components/panels/NewsFeedPanel.tsx        — News feed with tabs (All/news/official)
src/components/panels/DefenseNewsPanel.tsx     — Defense news articles
src/components/panels/NewsDigestPanel.tsx      — AI-generated news digest
src/components/panels/PredictionMarketsPanel.tsx — Prediction markets with AI implications
src/components/panels/SocialMonitorPanel.tsx   — Social/Telegram feed with credibility
src/components/panels/MissileCountsPanel.tsx   — Missile/attack counts chart
src/components/panels/FlightTrackerPanel.tsx   — Flight tracker table
src/components/layout/AnnouncementBanner.tsx   — Dismissable announcement banner
src/components/layout/KeyboardShortcuts.tsx    — Keyboard shortcuts modal
src/components/threats/ThreatHistoryChart.tsx  — Threat score history chart
src/components/threats/AIAssessment.tsx        — AI assessment text panel
src/app/api/news/route.ts                     — News events endpoint
src/app/api/social/route.ts                   — Social events endpoint
src/app/api/flights/route.ts                  — Flight position events endpoint
src/app/api/digest/route.ts                   — AI news digest endpoint
src/app/api/missile-counts/route.ts           — Missile/attack count stats endpoint
src/app/api/threat/history/route.ts           — Threat score history endpoint
src/app/api/announcements/route.ts            — Announcements endpoint
src/lib/db/schema.ts                          — Modify: add announcements table
```

### Modified Files
```
src/lib/store.ts                              — Add new state slices for panels, announcements, sounds, playback
src/app/page.tsx                              — Add BottomPanels, AnnouncementBanner, KeyboardShortcuts
src/components/layout/Header.tsx              — Add connection indicator, suggest source, edit buttons
src/components/layout/Sidebar.tsx             — Add alert sound toggle
src/components/alerts/AlertFeed.tsx           — Add sound toggle button
src/components/timeline/TimelineBar.tsx       — Enable playback controls, add keyboard shortcut button
src/components/threats/ThreatPanel.tsx        — Add country score buttons, link to history chart
src/app/globals.css                           — Add panel animations, new utility styles
```

---

## Phase 1: Foundation — Panel System & Store Extensions

### Task 1: PanelContainer Component

**Files:**
- Create: `src/components/panels/PanelContainer.tsx`

- [ ] **Step 1: Create the PanelContainer component**

```tsx
'use client';

import { useState, ReactNode } from 'react';

interface PanelContainerProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  defaultMinimized?: boolean;
}

export default function PanelContainer({
  title,
  icon,
  children,
  actions,
  defaultMinimized = false,
}: PanelContainerProps) {
  const [minimized, setMinimized] = useState(defaultMinimized);
  const [maximized, setMaximized] = useState(false);

  return (
    <div
      className={`flex flex-col border border-border rounded bg-surface ${
        maximized ? 'fixed inset-4 z-50' : 'h-full'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-elevated shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wide">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          <button
            onClick={() => setMinimized((m) => !m)}
            className="p-1 text-muted hover:text-foreground transition-colors"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {minimized ? (
                <polyline points="15 3 21 3 21 9" />
              ) : (
                <line x1="5" y1="12" x2="19" y2="12" />
              )}
            </svg>
          </button>
          <button
            onClick={() => setMaximized((m) => !m)}
            className="p-1 text-muted hover:text-foreground transition-colors"
            title={maximized ? 'Restore' : 'Maximize'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {maximized ? (
                <>
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                </>
              ) : (
                <rect x="3" y="3" width="18" height="18" rx="2" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {!minimized && (
        <div className="flex-1 overflow-auto p-2 text-xs">
          {children}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `npx next build 2>&1 | head -20` — should compile without errors referencing PanelContainer.

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/PanelContainer.tsx
git commit -m "feat: add PanelContainer with minimize/maximize controls"
```

---

### Task 2: Extend Zustand Store

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Add new data interfaces and state**

Add these interfaces after the existing `TickerItemData` interface:

```typescript
export interface NewsItem {
  id: string;
  title: string;
  url: string | null;
  source: string;
  category: string;
  timestamp: string;
}

export interface SocialPost {
  id: string;
  channel: string;
  channelUrl: string;
  text: string;
  messageUrl: string | null;
  credibility: number;
  verified: boolean;
  platform: string;
  timestamp: string;
}

export interface FlightPosition {
  id: string;
  callsign: string;
  type: string;
  altitude: number;
  speed: number;
  heading: number;
  status: string;
  isMilitary: boolean;
  lat: number;
  lng: number;
  timestamp: string;
}

export interface DigestData {
  summary: string;
  bullets: string[];
  generatedAt: string;
}

export interface MissileCountData {
  dates: string[];
  alerts: number[];
  strikes: number[];
  totalAlerts: number;
  totalStrikes: number;
  since: string;
}

export interface ThreatHistoryPoint {
  timestamp: string;
  score: number;
}

export interface AnnouncementData {
  id: string;
  text: string;
  createdAt: string;
}
```

- [ ] **Step 2: Extend AppState interface**

Add to the AppState interface (after existing fields):

```typescript
  // Panel data
  news: NewsItem[];
  socialPosts: SocialPost[];
  flights: FlightPosition[];
  digest: DigestData | null;
  missileCounts: MissileCountData | null;
  threatHistory: ThreatHistoryPoint[];
  announcement: AnnouncementData | null;
  
  // UI state
  announcementDismissed: boolean;
  soundEnabled: boolean;
  
  // Panel data fetchers
  fetchNews: () => Promise<void>;
  fetchSocial: () => Promise<void>;
  fetchFlights: () => Promise<void>;
  fetchDigest: () => Promise<void>;
  fetchMissileCounts: () => Promise<void>;
  fetchThreatHistory: (range: string) => Promise<void>;
  fetchAnnouncement: () => Promise<void>;
  dismissAnnouncement: () => void;
  toggleSound: () => void;
```

- [ ] **Step 3: Add initial state and action implementations**

Add inside `create<AppState>()((set, get) => ({` after existing state:

```typescript
  news: [],
  socialPosts: [],
  flights: [],
  digest: null,
  missileCounts: null,
  threatHistory: [],
  announcement: null,
  announcementDismissed: false,
  soundEnabled: false,

  fetchNews: async () => {
    try {
      const res = await fetch('/api/news');
      if (!res.ok) return;
      const data = await res.json();
      set({ news: data.items ?? [] });
    } catch { /* ignore */ }
  },

  fetchSocial: async () => {
    try {
      const res = await fetch('/api/social');
      if (!res.ok) return;
      const data = await res.json();
      set({ socialPosts: data.items ?? [] });
    } catch { /* ignore */ }
  },

  fetchFlights: async () => {
    try {
      const res = await fetch('/api/flights');
      if (!res.ok) return;
      const data = await res.json();
      set({ flights: data.items ?? [] });
    } catch { /* ignore */ }
  },

  fetchDigest: async () => {
    try {
      const res = await fetch('/api/digest');
      if (!res.ok) return;
      const data = await res.json();
      set({ digest: data.digest ?? null });
    } catch { /* ignore */ }
  },

  fetchMissileCounts: async () => {
    try {
      const res = await fetch('/api/missile-counts');
      if (!res.ok) return;
      const data = await res.json();
      set({ missileCounts: data ?? null });
    } catch { /* ignore */ }
  },

  fetchThreatHistory: async (range: string) => {
    try {
      const res = await fetch(`/api/threat/history?range=${range}`);
      if (!res.ok) return;
      const data = await res.json();
      set({ threatHistory: data.history ?? [] });
    } catch { /* ignore */ }
  },

  fetchAnnouncement: async () => {
    try {
      const res = await fetch('/api/announcements');
      if (!res.ok) return;
      const data = await res.json();
      set({ announcement: data.announcement ?? null });
    } catch { /* ignore */ }
  },

  dismissAnnouncement: () => set({ announcementDismissed: true }),

  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
```

- [ ] **Step 4: Verify build**

Run: `npx next build 2>&1 | tail -5` — should compile.

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts
git commit -m "feat: extend store with panel data, announcements, sound state"
```

---

## Phase 2: API Endpoints

### Task 3: News API Endpoint

**Files:**
- Create: `src/app/api/news/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      source: events.source,
      sourceId: events.sourceId,
      metadata: events.metadata,
      timestamp: events.timestamp,
    })
    .from(events)
    .where(inArray(events.type, ['news']))
    .orderBy(desc(events.timestamp))
    .limit(50);

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: (r.metadata as Record<string, unknown>)?.url as string | null ?? null,
    source: r.source,
    category: (r.metadata as Record<string, unknown>)?.category as string ?? 'news',
    timestamp: r.timestamp.toISOString(),
  }));

  return NextResponse.json({ items });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/news/route.ts
git commit -m "feat: add /api/news endpoint for news feed panel"
```

---

### Task 4: Social API Endpoint

**Files:**
- Create: `src/app/api/social/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      source: events.source,
      sourceId: events.sourceId,
      metadata: events.metadata,
      corroborated: events.corroborated,
      timestamp: events.timestamp,
    })
    .from(events)
    .where(eq(events.type, 'social'))
    .orderBy(desc(events.timestamp))
    .limit(50);

  const items = rows.map((r) => {
    const meta = r.metadata as Record<string, unknown>;
    return {
      id: r.id,
      channel: meta?.channel as string ?? r.source,
      channelUrl: meta?.channelUrl as string ?? `https://t.me/${r.source}`,
      text: r.description ?? r.title,
      messageUrl: meta?.messageUrl as string | null ?? null,
      credibility: (meta?.credibility as number) ?? 50,
      verified: r.corroborated ?? false,
      platform: meta?.platform as string ?? 'Telegram',
      timestamp: r.timestamp.toISOString(),
    };
  });

  return NextResponse.json({ items });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/social/route.ts
git commit -m "feat: add /api/social endpoint for social monitor panel"
```

---

### Task 5: Flights API Endpoint

**Files:**
- Create: `src/app/api/flights/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { desc, eq, and, isNotNull } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      source: events.source,
      metadata: events.metadata,
      lat: events.lat,
      lng: events.lng,
      isActive: events.isActive,
      timestamp: events.timestamp,
    })
    .from(events)
    .where(
      and(
        eq(events.type, 'flight'),
        eq(events.isActive, true),
        isNotNull(events.lat),
        isNotNull(events.lng),
      )
    )
    .orderBy(desc(events.timestamp))
    .limit(100);

  const items = rows.map((r) => {
    const meta = r.metadata as Record<string, unknown>;
    const callsign = (meta?.callsign as string) ?? '-';
    const isMil = callsign.startsWith('RCH') ||
      callsign.startsWith('FORTE') ||
      (meta?.category as string)?.includes('mil') ||
      (meta?.type as string)?.includes('MIL');
    return {
      id: r.id,
      callsign,
      type: isMil ? 'MIL' : (meta?.aircraftType as string ?? '-'),
      altitude: (meta?.altitude as number) ?? 0,
      speed: (meta?.speed as number) ?? 0,
      heading: (meta?.heading as number) ?? 0,
      status: (meta?.status as string) ?? 'unknown',
      isMilitary: isMil,
      lat: r.lat!,
      lng: r.lng!,
      timestamp: r.timestamp.toISOString(),
    };
  });

  return NextResponse.json({ items });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/flights/route.ts
git commit -m "feat: add /api/flights endpoint for flight tracker panel"
```

---

### Task 6: Missile Counts API Endpoint

**Files:**
- Create: `src/app/api/missile-counts/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { events } from '@/lib/db/schema';
import { sql, and, inArray, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const since = new Date('2025-02-27T00:00:00Z');

  // Daily counts for chart
  const dailyCounts = await db
    .select({
      date: sql<string>`date_trunc('day', ${events.timestamp})::date::text`.as('date'),
      alerts: sql<number>`count(*) filter (where ${events.type} = 'alert')`.as('alerts'),
      strikes: sql<number>`count(*) filter (where ${events.type} = 'strike')`.as('strikes'),
    })
    .from(events)
    .where(
      and(
        gte(events.timestamp, since),
        inArray(events.type, ['alert', 'strike']),
      )
    )
    .groupBy(sql`date_trunc('day', ${events.timestamp})::date`)
    .orderBy(sql`date_trunc('day', ${events.timestamp})::date`);

  // Totals
  const totals = await db
    .select({
      totalAlerts: sql<number>`count(*) filter (where ${events.type} = 'alert')`.as('totalAlerts'),
      totalStrikes: sql<number>`count(*) filter (where ${events.type} = 'strike')`.as('totalStrikes'),
    })
    .from(events)
    .where(
      and(
        gte(events.timestamp, since),
        inArray(events.type, ['alert', 'strike']),
      )
    );

  return NextResponse.json({
    dates: dailyCounts.map((r) => r.date),
    alerts: dailyCounts.map((r) => Number(r.alerts)),
    strikes: dailyCounts.map((r) => Number(r.strikes)),
    totalAlerts: Number(totals[0]?.totalAlerts ?? 0),
    totalStrikes: Number(totals[0]?.totalStrikes ?? 0),
    since: since.toISOString(),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/missile-counts/route.ts
git commit -m "feat: add /api/missile-counts endpoint for attack chart panel"
```

---

### Task 7: Threat History API Endpoint

**Files:**
- Create: `src/app/api/threat/history/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { threatAssessments } from '@/lib/db/schema';
import { desc, gte } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const RANGE_MS: Record<string, number> = {
  '1h': 3600_000,
  '6h': 21600_000,
  '24h': 86400_000,
  '7d': 604800_000,
  '30d': 2592000_000,
};

export async function GET(request: NextRequest) {
  const range = request.nextUrl.searchParams.get('range') ?? '24h';
  const ms = RANGE_MS[range] ?? RANGE_MS['24h'];
  const since = new Date(Date.now() - ms);

  const rows = await db
    .select({
      timestamp: threatAssessments.createdAt,
      score: threatAssessments.overallScore,
    })
    .from(threatAssessments)
    .where(gte(threatAssessments.createdAt, since))
    .orderBy(desc(threatAssessments.createdAt));

  const history = rows.map((r) => ({
    timestamp: r.timestamp.toISOString(),
    score: Number(r.score),
  }));

  return NextResponse.json({ history });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/threat/history/route.ts
git commit -m "feat: add /api/threat/history endpoint for threat chart"
```

---

### Task 8: Digest API Endpoint

**Files:**
- Create: `src/app/api/digest/route.ts`

- [ ] **Step 1: Create the endpoint**

This endpoint returns the latest AI assessment's situation/trend/overall text formatted as a digest. The AI assessment worker already generates this content, so we reuse it.

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { threatAssessments } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const latest = await db
    .select({
      situationText: threatAssessments.situationText,
      trendText: threatAssessments.trendText,
      overallText: threatAssessments.overallText,
      createdAt: threatAssessments.createdAt,
    })
    .from(threatAssessments)
    .orderBy(desc(threatAssessments.createdAt))
    .limit(1);

  if (!latest.length) {
    return NextResponse.json({ digest: null });
  }

  const row = latest[0];
  return NextResponse.json({
    digest: {
      summary: row.overallText,
      bullets: [row.situationText, row.trendText],
      generatedAt: row.createdAt.toISOString(),
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/digest/route.ts
git commit -m "feat: add /api/digest endpoint for news digest panel"
```

---

### Task 9: Announcements API Endpoint + DB Schema

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/app/api/announcements/route.ts`

- [ ] **Step 1: Add announcements table to schema**

Add at the end of `src/lib/db/schema.ts`:

```typescript
export const announcements = pgTable('announcements', {
  id: uuid('id').primaryKey().defaultRandom(),
  text: text('text').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Create the endpoint**

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { announcements } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(announcements)
      .where(eq(announcements.isActive, true))
      .orderBy(desc(announcements.createdAt))
      .limit(1);

    return NextResponse.json({
      announcement: rows[0]
        ? { id: rows[0].id, text: rows[0].text, createdAt: rows[0].createdAt.toISOString() }
        : null,
    });
  } catch {
    // Table may not exist yet — graceful fallback
    return NextResponse.json({ announcement: null });
  }
}
```

- [ ] **Step 3: Generate and run migration**

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/app/api/announcements/route.ts src/lib/db/migrations/
git commit -m "feat: add announcements table and API endpoint"
```

---

## Phase 3: Sidebar Enhancements

### Task 10: AI Assessment Component

**Files:**
- Create: `src/components/threats/AIAssessment.tsx`
- Modify: `src/components/threats/ThreatPanel.tsx`

- [ ] **Step 1: Create AIAssessment component**

```tsx
'use client';

import { useAppStore } from '@/lib/store';

export default function AIAssessment() {
  const threat = useAppStore((s) => s.threat);

  if (!threat) {
    return (
      <div className="px-3 py-2 text-xs text-muted">
        Awaiting AI assessment...
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-3 text-xs">
      <div>
        <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
          Current Situation
        </div>
        <p className="text-foreground/80 leading-relaxed">{threat.situationText}</p>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
          Recent Trend
        </div>
        <p className="text-foreground/80 leading-relaxed">{threat.trendText}</p>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
          Overall
        </div>
        <p className="text-foreground/80 leading-relaxed">{threat.overallText}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add AI Assessment to ThreatPanel**

In `src/components/threats/ThreatPanel.tsx`, add import at top:

```typescript
import AIAssessment from './AIAssessment';
```

Add `<AIAssessment />` after the country bars section (after the closing `</div>` of the countries map).

- [ ] **Step 3: Commit**

```bash
git add src/components/threats/AIAssessment.tsx src/components/threats/ThreatPanel.tsx
git commit -m "feat: add AI assessment text to threat panel"
```

---

### Task 11: Threat History Chart

**Files:**
- Create: `src/components/threats/ThreatHistoryChart.tsx`
- Modify: `src/components/threats/ThreatPanel.tsx`

- [ ] **Step 1: Create the chart component**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const RANGES = ['1h', '6h', '24h', '7d', '30d'] as const;

export default function ThreatHistoryChart() {
  const [range, setRange] = useState<string>('24h');
  const history = useAppStore((s) => s.threatHistory);
  const fetchThreatHistory = useAppStore((s) => s.fetchThreatHistory);

  useEffect(() => {
    fetchThreatHistory(range);
  }, [range, fetchThreatHistory]);

  const data = [...history].reverse().map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    score: h.score,
  }));

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
          History
        </span>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-1.5 py-0.5 text-[10px] rounded ${
                range === r
                  ? 'bg-info/20 text-info'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="h-16">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 10]} hide />
              <Tooltip
                contentStyle={{ background: '#171717', border: '1px solid #262626', fontSize: 11 }}
                labelStyle={{ color: '#737373' }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-[10px] text-muted">
            Not enough data
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add chart to ThreatPanel**

In `src/components/threats/ThreatPanel.tsx`, add import:

```typescript
import ThreatHistoryChart from './ThreatHistoryChart';
```

Add `<ThreatHistoryChart />` after the overall score display section, before the country bars.

- [ ] **Step 3: Commit**

```bash
git add src/components/threats/ThreatHistoryChart.tsx src/components/threats/ThreatPanel.tsx
git commit -m "feat: add threat level history chart with time range selector"
```

---

### Task 12: Alert Sound Toggle

**Files:**
- Modify: `src/components/alerts/AlertFeed.tsx`

- [ ] **Step 1: Add sound toggle to AlertFeed header**

In `src/components/alerts/AlertFeed.tsx`, add to the destructured store state:

```typescript
const soundEnabled = useAppStore((s) => s.soundEnabled);
const toggleSound = useAppStore((s) => s.toggleSound);
```

Add a sound toggle button next to the alert counter badge in the header div:

```tsx
<button
  onClick={toggleSound}
  className={`p-1 rounded transition-colors ${
    soundEnabled ? 'text-info' : 'text-muted hover:text-foreground'
  }`}
  title={soundEnabled ? 'Disable alert sounds' : 'Enable alert sounds'}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {soundEnabled ? (
      <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </>
    ) : (
      <>
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </>
    )}
  </svg>
</button>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/alerts/AlertFeed.tsx
git commit -m "feat: add alert sound toggle button to alert feed"
```

---

### Task 13: Connection Status Indicator in Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add connection status color logic**

Replace the current "last update" display section. The logic: green if updated < 30s ago, yellow if < 120s, red otherwise. In Header.tsx, compute the status:

```tsx
const getConnectionColor = () => {
  if (!lastUpdate) return 'bg-red-500';
  const age = Date.now() - new Date(lastUpdate).getTime();
  if (age < 30_000) return 'bg-green-500';
  if (age < 120_000) return 'bg-yellow-500';
  return 'bg-red-500';
};
```

Replace the plain "upd" text with a colored dot + text:

```tsx
<div className="flex items-center gap-1.5 text-[10px] text-muted">
  <span className={`w-2 h-2 rounded-full ${getConnectionColor()}`} />
  <span>
    upd {lastUpdate
      ? formatDistanceToNow(new Date(lastUpdate), { addSuffix: true })
      : 'never'}
  </span>
</div>
```

Import `formatDistanceToNow` from `date-fns` if not already imported.

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add color-coded connection status indicator to header"
```

---

### Task 14: Suggest Source & Edit Buttons in Header

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: Add buttons after the language selector**

Add these buttons in the header right section, after the EN button:

```tsx
<button
  className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted hover:text-foreground border border-border rounded transition-colors"
  title="Suggest a new OSINT source"
  onClick={() => window.open('https://forms.gle/placeholder', '_blank')}
>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
  Suggest Source
</button>
<button
  className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted hover:text-foreground border border-border rounded transition-colors"
  title="Submit a correction"
>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
  Edit
</button>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add Suggest Source and Edit buttons to header"
```

---

### Task 15: Announcement Banner

**Files:**
- Create: `src/components/layout/AnnouncementBanner.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the banner component**

```tsx
'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export default function AnnouncementBanner() {
  const announcement = useAppStore((s) => s.announcement);
  const dismissed = useAppStore((s) => s.announcementDismissed);
  const fetchAnnouncement = useAppStore((s) => s.fetchAnnouncement);
  const dismissAnnouncement = useAppStore((s) => s.dismissAnnouncement);

  useEffect(() => {
    fetchAnnouncement();
  }, [fetchAnnouncement]);

  if (!announcement || dismissed) return null;

  return (
    <div className="flex items-start gap-3 px-4 py-2 bg-surface-elevated border-b border-border text-xs text-foreground/80">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5 text-info">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <p className="flex-1 leading-relaxed">{announcement.text}</p>
      <button
        onClick={dismissAnnouncement}
        className="shrink-0 p-1 text-muted hover:text-foreground transition-colors"
        title="Dismiss announcement"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add banner to page layout**

In `src/app/page.tsx`, import and add `<AnnouncementBanner />` right after `<Header />`:

```typescript
import AnnouncementBanner from '@/components/layout/AnnouncementBanner';
```

```tsx
<Header />
<AnnouncementBanner />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/AnnouncementBanner.tsx src/app/page.tsx
git commit -m "feat: add dismissable announcement banner"
```

---

## Phase 4: Bottom Panels

### Task 16: Bottom Panels Layout

**Files:**
- Create: `src/components/panels/BottomPanels.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create BottomPanels grid layout**

```tsx
'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import NewsFeedPanel from './NewsFeedPanel';
import DefenseNewsPanel from './DefenseNewsPanel';
import NewsDigestPanel from './NewsDigestPanel';
import PredictionMarketsPanel from './PredictionMarketsPanel';
import SocialMonitorPanel from './SocialMonitorPanel';
import MissileCountsPanel from './MissileCountsPanel';
import FlightTrackerPanel from './FlightTrackerPanel';

export default function BottomPanels() {
  const fetchNews = useAppStore((s) => s.fetchNews);
  const fetchSocial = useAppStore((s) => s.fetchSocial);
  const fetchFlights = useAppStore((s) => s.fetchFlights);
  const fetchDigest = useAppStore((s) => s.fetchDigest);
  const fetchMissileCounts = useAppStore((s) => s.fetchMissileCounts);

  useEffect(() => {
    fetchNews();
    fetchSocial();
    fetchFlights();
    fetchDigest();
    fetchMissileCounts();

    const interval = setInterval(() => {
      fetchNews();
      fetchSocial();
      fetchFlights();
    }, 30_000);

    return () => clearInterval(interval);
  }, [fetchNews, fetchSocial, fetchFlights, fetchDigest, fetchMissileCounts]);

  return (
    <div className="h-64 border-t border-border bg-background shrink-0 overflow-hidden">
      <div className="flex h-full gap-px bg-border">
        <div className="flex-1 min-w-0 bg-background">
          <NewsFeedPanel />
        </div>
        <div className="flex-1 min-w-0 bg-background">
          <DefenseNewsPanel />
        </div>
        <div className="flex-1 min-w-0 bg-background">
          <NewsDigestPanel />
        </div>
        <div className="flex-1 min-w-0 bg-background">
          <PredictionMarketsPanel />
        </div>
        <div className="flex-1 min-w-0 bg-background">
          <SocialMonitorPanel />
        </div>
        <div className="flex-1 min-w-0 bg-background">
          <MissileCountsPanel />
        </div>
        <div className="flex-1 min-w-0 bg-background">
          <FlightTrackerPanel />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to page layout**

In `src/app/page.tsx`, add the import and place `<BottomPanels />` between the map area and `<TimelineBar />`:

```typescript
import BottomPanels from '@/components/panels/BottomPanels';
```

Insert in the JSX between the map container div and TimelineBar.

- [ ] **Step 3: Commit**

```bash
git add src/components/panels/BottomPanels.tsx src/app/page.tsx
git commit -m "feat: add bottom panels grid layout with 7-panel structure"
```

---

### Task 17: News Feed Panel

**Files:**
- Create: `src/components/panels/NewsFeedPanel.tsx`

- [ ] **Step 1: Create the panel**

```tsx
'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import PanelContainer from './PanelContainer';

const TABS = ['All', 'news', 'official statement'] as const;

export default function NewsFeedPanel() {
  const news = useAppStore((s) => s.news);
  const [tab, setTab] = useState<string>('All');

  const filtered = tab === 'All'
    ? news
    : news.filter((n) => n.category === tab);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minutes ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hours ago`;
    return `${Math.floor(hrs / 24)} days ago`;
  };

  return (
    <PanelContainer title="News Feed">
      <div className="flex items-center gap-1 mb-2">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-1.5 py-0.5 text-[10px] rounded ${
              tab === t ? 'bg-info/20 text-info' : 'text-muted hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-muted text-[10px]">No news items</p>
        )}
        {filtered.map((item) => (
          <div key={item.id} className="space-y-0.5">
            <div className="flex items-start gap-1">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-info transition-colors leading-tight"
                >
                  {item.title}
                </a>
              ) : (
                <span className="text-foreground leading-tight">{item.title}</span>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted hover:text-info"
                  title="Open source"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span>{item.source}</span>
              <span>{timeAgo(item.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </PanelContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/NewsFeedPanel.tsx
git commit -m "feat: add news feed panel with category tabs"
```

---

### Task 18: Defense News Panel

**Files:**
- Create: `src/components/panels/DefenseNewsPanel.tsx`

- [ ] **Step 1: Create the panel**

```tsx
'use client';

import { useAppStore } from '@/lib/store';
import PanelContainer from './PanelContainer';

export default function DefenseNewsPanel() {
  const news = useAppStore((s) => s.news);

  // Filter to defense-related categories
  const defenseNews = news.filter(
    (n) => n.source.includes('CENTCOM') ||
           n.source.includes('NATO') ||
           n.source.includes('defense') ||
           n.category === 'iran_military' ||
           n.category === 'defense'
  );

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minutes ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hours ago`;
    return `${Math.floor(hrs / 24)} days ago`;
  };

  return (
    <PanelContainer title="Defense News">
      <div className="space-y-2">
        {defenseNews.length === 0 && (
          <p className="text-muted text-[10px]">No defense news</p>
        )}
        {defenseNews.map((item) => (
          <div key={item.id} className="space-y-0.5">
            <div className="flex items-start gap-1">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-info transition-colors leading-tight"
                >
                  {item.title}
                </a>
              ) : (
                <span className="text-foreground leading-tight">{item.title}</span>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted hover:text-info"
                  title="Open source"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span>{item.source}</span>
              <span>{timeAgo(item.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </PanelContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/DefenseNewsPanel.tsx
git commit -m "feat: add defense news panel"
```

---

### Task 19: News Digest Panel

**Files:**
- Create: `src/components/panels/NewsDigestPanel.tsx`

- [ ] **Step 1: Create the panel**

```tsx
'use client';

import { useAppStore } from '@/lib/store';
import PanelContainer from './PanelContainer';

export default function NewsDigestPanel() {
  const digest = useAppStore((s) => s.digest);
  const fetchDigest = useAppStore((s) => s.fetchDigest);

  const regenerateAction = (
    <button
      onClick={() => fetchDigest()}
      className="p-1 text-muted hover:text-foreground transition-colors"
      title="Regenerate summary"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
    </button>
  );

  return (
    <PanelContainer title="News Digest" actions={regenerateAction}>
      {!digest ? (
        <p className="text-muted text-[10px]">Generating digest...</p>
      ) : (
        <div className="space-y-2">
          <h3 className="text-foreground font-medium leading-tight">
            {digest.summary}
          </h3>
          <ul className="space-y-1.5 list-disc list-inside text-foreground/80 leading-relaxed">
            {digest.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}
    </PanelContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/NewsDigestPanel.tsx
git commit -m "feat: add AI news digest panel with regenerate button"
```

---

### Task 20: Prediction Markets Panel

**Files:**
- Create: `src/components/panels/PredictionMarketsPanel.tsx`

- [ ] **Step 1: Create the panel**

This panel reuses the threat assessment's overall text and trend data as "AI Implications" — similar to how the public site presents prediction market analysis derived from the AI assessment.

```tsx
'use client';

import { useAppStore } from '@/lib/store';
import PanelContainer from './PanelContainer';

export default function PredictionMarketsPanel() {
  const threat = useAppStore((s) => s.threat);

  return (
    <PanelContainer title="Prediction Markets">
      {!threat ? (
        <p className="text-muted text-[10px]">Awaiting market data...</p>
      ) : (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-wider">
            AI Implications
          </div>
          <p className="text-foreground/80 leading-relaxed">
            {threat.overallText}
          </p>
          {threat.situationText && (
            <ul className="space-y-1.5 list-disc list-inside text-foreground/80 leading-relaxed">
              <li>{threat.situationText}</li>
              <li>{threat.trendText}</li>
            </ul>
          )}
        </div>
      )}
    </PanelContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/PredictionMarketsPanel.tsx
git commit -m "feat: add prediction markets panel with AI implications"
```

---

### Task 21: Social Monitor Panel

**Files:**
- Create: `src/components/panels/SocialMonitorPanel.tsx`

- [ ] **Step 1: Create the panel**

```tsx
'use client';

import { useAppStore } from '@/lib/store';
import PanelContainer from './PanelContainer';

export default function SocialMonitorPanel() {
  const posts = useAppStore((s) => s.socialPosts);

  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minutes ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `about ${hrs} hours ago`;
    return `${Math.floor(hrs / 24)} days ago`;
  };

  return (
    <PanelContainer title="Social Monitor">
      <div className="space-y-3">
        {posts.length === 0 && (
          <p className="text-muted text-[10px]">No social posts</p>
        )}
        {posts.map((post) => (
          <div key={post.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 shrink-0">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              <span className="text-muted">{post.platform}</span>
              <a
                href={post.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline"
              >
                {post.channel}
              </a>
              <span className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                post.verified
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {post.verified ? 'Verified' : 'Unverified'}
              </span>
            </div>
            <p className="text-foreground/80 leading-relaxed">{post.text}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted">
              <span>{timeAgo(post.timestamp)}</span>
              <span>|</span>
              <span>Credibility: {post.credibility}%</span>
              {post.messageUrl && (
                <>
                  <span>|</span>
                  <a
                    href={post.messageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info hover:underline"
                  >
                    Message
                  </a>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </PanelContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/SocialMonitorPanel.tsx
git commit -m "feat: add social monitor panel with credibility scoring"
```

---

### Task 22: Missile / Attack Counts Panel

**Files:**
- Create: `src/components/panels/MissileCountsPanel.tsx`

- [ ] **Step 1: Create the panel**

```tsx
'use client';

import { useAppStore } from '@/lib/store';
import PanelContainer from './PanelContainer';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export default function MissileCountsPanel() {
  const counts = useAppStore((s) => s.missileCounts);

  if (!counts) {
    return (
      <PanelContainer title="Missile / Attack Counts">
        <p className="text-muted text-[10px]">Loading data...</p>
      </PanelContainer>
    );
  }

  const data = counts.dates.map((d, i) => ({
    date: new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    alerts: counts.alerts[i],
    strikes: counts.strikes[i],
  }));

  return (
    <PanelContainer title="Missile / Attack Counts">
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#737373' }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 9, fill: '#737373' }} width={40} />
            <Tooltip
              contentStyle={{
                background: '#171717',
                border: '1px solid #262626',
                fontSize: 11,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 10 }}
              iconSize={8}
            />
            <Bar dataKey="alerts" name="Alerts (proxy)" fill="#f97316" />
            <Bar dataKey="strikes" name="Confirmed Strikes" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[10px] text-muted mt-1">
        Total since {new Date(counts.since).toLocaleDateString([], { month: 'short', day: 'numeric' })}:{' '}
        <span className="text-foreground">{counts.totalAlerts.toLocaleString()} alerts</span>
        {' | '}
        <span className="text-foreground">{counts.totalStrikes.toLocaleString()} confirmed strikes</span>
      </div>
    </PanelContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/MissileCountsPanel.tsx
git commit -m "feat: add missile/attack counts panel with bar chart"
```

---

### Task 23: Flight Tracker Panel

**Files:**
- Create: `src/components/panels/FlightTrackerPanel.tsx`

- [ ] **Step 1: Create the panel**

```tsx
'use client';

import { useAppStore } from '@/lib/store';
import PanelContainer from './PanelContainer';

export default function FlightTrackerPanel() {
  const flights = useAppStore((s) => s.flights);

  return (
    <PanelContainer title="Flight Tracker">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-muted text-left border-b border-border">
            <th className="pb-1 font-medium">Callsign</th>
            <th className="pb-1 font-medium">Type</th>
            <th className="pb-1 font-medium">Alt</th>
            <th className="pb-1 font-medium">Spd</th>
            <th className="pb-1 font-medium">Hdg</th>
            <th className="pb-1 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {flights.length === 0 && (
            <tr>
              <td colSpan={6} className="py-2 text-muted text-center">
                No active flights
              </td>
            </tr>
          )}
          {flights.map((f) => (
            <tr
              key={f.id}
              className="border-b border-border/50 hover:bg-surface-elevated cursor-pointer transition-colors"
            >
              <td className="py-1">
                <div className="flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={f.isMilitary ? 'text-critical' : 'text-info'}
                    style={{ transform: `rotate(${f.heading}deg)` }}
                  >
                    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.4-.1.9.3 1.1L11 12l-2 3H6l-1 1 3 2 2 3 1-1v-3l3-2 3.5 7.3c.3.4.7.5 1.1.3l.5-.3c.4-.2.6-.7.5-1.1z" />
                  </svg>
                  <span className="text-foreground">{f.callsign}</span>
                  {f.isMilitary && (
                    <span className="px-1 py-0.5 bg-critical/20 text-critical rounded text-[8px] font-medium">
                      MIL
                    </span>
                  )}
                </div>
              </td>
              <td className="py-1 text-muted">{f.type}</td>
              <td className="py-1 text-muted">{f.altitude > 0 ? `${Math.round(f.altitude / 1000)}k` : '-'}</td>
              <td className="py-1 text-muted">{f.speed > 0 ? `${f.speed}kt` : '-'}</td>
              <td className="py-1 text-muted">
                <div className="flex items-center gap-0.5">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ transform: `rotate(${f.heading}deg)` }}
                  >
                    <path d="M12 2l7 20-7-5-7 5z" fill="currentColor" />
                  </svg>
                  {f.heading}
                </div>
              </td>
              <td className="py-1">
                <span className={`text-[9px] ${
                  f.status === 'airborne' ? 'text-green-400' :
                  f.status === 'ground' ? 'text-yellow-400' :
                  'text-muted'
                }`}>
                  {f.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/panels/FlightTrackerPanel.tsx
git commit -m "feat: add flight tracker panel with sortable table"
```

---

## Phase 5: Playback & Keyboard Shortcuts

### Task 24: Enable Playback Controls

**Files:**
- Modify: `src/components/timeline/TimelineBar.tsx`

- [ ] **Step 1: Enable the previously disabled playback buttons**

In `src/components/timeline/TimelineBar.tsx`, find the playback control buttons (skip back, pause, skip forward, LIVE). They currently have `disabled` or `cursor-not-allowed`. Remove the disabled state and add onClick handlers.

Replace the playback controls section with functional buttons:

```tsx
{/* Playback controls */}
<div className="flex items-center gap-1">
  <button
    onClick={() => {/* Step back: move currentTime by -1 bucket */}}
    className="p-1 text-muted hover:text-foreground transition-colors"
    title="Step back (Left Arrow)"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="19 20 9 12 19 4 19 20" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </svg>
  </button>
  <button
    onClick={() => {/* Toggle play/pause */}}
    className="p-1.5 text-muted hover:text-foreground transition-colors"
    title="Pause — enter playback (Space)"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  </button>
  <button
    onClick={() => {/* Step forward: move currentTime by +1 bucket */}}
    className="p-1 text-muted hover:text-foreground transition-colors"
    title="Step forward (Right Arrow)"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  </button>
</div>

{/* LIVE button */}
<button
  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
    true /* isLive */
      ? 'bg-green-500/20 text-green-400'
      : 'bg-surface-elevated text-muted hover:text-foreground'
  }`}
  title="Return to live"
>
  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="8" />
  </svg>
  LIVE
</button>

{/* Speed controls */}
<div className="flex items-center gap-1">
  <button
    className="p-0.5 text-muted hover:text-foreground transition-colors"
    title="Speed down (-)"
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>
  <span className="text-[10px] text-foreground min-w-[2ch] text-center">1x</span>
  <button
    className="p-0.5 text-muted hover:text-foreground transition-colors"
    title="Speed up (+)"
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  </button>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/timeline/TimelineBar.tsx
git commit -m "feat: enable playback controls in timeline bar"
```

---

### Task 25: Keyboard Shortcuts Modal

**Files:**
- Create: `src/components/layout/KeyboardShortcuts.tsx`
- Modify: `src/components/timeline/TimelineBar.tsx`

- [ ] **Step 1: Create the shortcuts modal**

```tsx
'use client';

import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Space', action: 'Play / Pause' },
  { key: '<Left Arrow>', action: 'Step back' },
  { key: '<Right Arrow>', action: 'Step forward' },
  { key: '+', action: 'Speed up' },
  { key: '-', action: 'Speed down' },
  { key: 'L', action: 'Return to live' },
  { key: 'S', action: 'Toggle sound' },
  { key: 'M', action: 'Toggle sidebar' },
  { key: '1-5', action: 'Focus area (Israel/Iran/Gulf/Red Sea/Region)' },
  { key: '?', action: 'Show/hide shortcuts' },
  { key: 'Esc', action: 'Close modal' },
];

export default function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-lg p-4 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-xs">
              <span className="text-foreground/80">{s.action}</span>
              <kbd className="px-1.5 py-0.5 bg-surface-elevated border border-border rounded text-[10px] text-muted font-mono">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add keyboard shortcut button to TimelineBar**

In `src/components/timeline/TimelineBar.tsx`, add state and the button at the end of the timeline controls:

```tsx
import { useState } from 'react';
import KeyboardShortcuts from '@/components/layout/KeyboardShortcuts';
```

Add state:
```tsx
const [showShortcuts, setShowShortcuts] = useState(false);
```

Add the button at the end of the timeline bar:
```tsx
<button
  onClick={() => setShowShortcuts(true)}
  className="px-1.5 py-0.5 text-[10px] text-muted hover:text-foreground border border-border rounded transition-colors"
  title="Keyboard shortcuts"
>
  ? Keys
</button>
<KeyboardShortcuts open={showShortcuts} onClose={() => setShowShortcuts(false)} />
```

- [ ] **Step 3: Add global keyboard listener**

In `src/app/page.tsx`, add a global keyboard effect inside the main component:

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    // Add keyboard shortcuts as we wire up more features
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/KeyboardShortcuts.tsx src/components/timeline/TimelineBar.tsx src/app/page.tsx
git commit -m "feat: add keyboard shortcuts modal and ? Keys button"
```

---

## Phase 6: Integration & Polish

### Task 26: Wire Up Data Fetching in Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add all new data fetch calls to useEffect**

In the existing `useEffect` in `src/app/page.tsx` that calls `fetchEvents()`, `fetchThreat()`, `fetchTicker()`, `connectSSE()`, add the new fetch calls:

```typescript
const fetchNews = useAppStore((s) => s.fetchNews);
const fetchSocial = useAppStore((s) => s.fetchSocial);
const fetchFlights = useAppStore((s) => s.fetchFlights);
const fetchDigest = useAppStore((s) => s.fetchDigest);
const fetchMissileCounts = useAppStore((s) => s.fetchMissileCounts);
const fetchAnnouncement = useAppStore((s) => s.fetchAnnouncement);
```

In the useEffect:
```typescript
fetchNews();
fetchSocial();
fetchFlights();
fetchDigest();
fetchMissileCounts();
fetchAnnouncement();
```

Note: BottomPanels.tsx already has its own polling interval (30s), so we only need the initial load here. The 60s threat interval already exists.

- [ ] **Step 2: Verify full page layout imports**

Ensure `src/app/page.tsx` imports:
```typescript
import AnnouncementBanner from '@/components/layout/AnnouncementBanner';
import BottomPanels from '@/components/panels/BottomPanels';
```

And the JSX order is:
```
Header
AnnouncementBanner
Sidebar + Map area
BottomPanels
TimelineBar
NewsTicker
```

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire up all panel data fetching in main page"
```

---

### Task 27: Country Labels on Map

**Files:**
- Modify: `src/components/map/MapContainer.tsx`

- [ ] **Step 1: Add country label markers**

In `MapContainer.tsx`, add a constant for country label positions:

```typescript
const COUNTRY_LABELS: { name: string; lng: number; lat: number }[] = [
  { name: 'ISRAEL', lng: 35.0, lat: 31.5 },
  { name: 'IRAN', lng: 53.0, lat: 32.5 },
  { name: 'IRAQ', lng: 44.0, lat: 33.0 },
  { name: 'SYRIA', lng: 38.5, lat: 35.0 },
  { name: 'SAUDI ARABIA', lng: 45.0, lat: 24.0 },
  { name: 'PERSIAN GULF', lng: 51.0, lat: 26.5 },
  { name: 'RED SEA', lng: 38.0, lat: 21.0 },
  { name: 'MEDITERRANEAN', lng: 32.0, lat: 34.5 },
  { name: 'LEBANON', lng: 35.8, lat: 33.9 },
  { name: 'EGYPT', lng: 30.0, lat: 26.0 },
  { name: 'TURKEY', lng: 35.0, lat: 39.0 },
];
```

After the map initializes, add text labels using markers:

```typescript
// Add country name labels
COUNTRY_LABELS.forEach(({ name, lng, lat }) => {
  const el = document.createElement('div');
  el.className = 'text-[10px] font-bold text-white/40 tracking-wider pointer-events-none select-none';
  el.textContent = name;
  new maplibregl.Marker({ element: el })
    .setLngLat([lng, lat])
    .addTo(map);
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/MapContainer.tsx
git commit -m "feat: add country name labels on map"
```

---

### Task 28: Build Verification

- [ ] **Step 1: Run full build**

```bash
cd /home/blorb/git/war-alerting-system && npx next build 2>&1 | tail -30
```

Expected: Build succeeds with no type errors.

- [ ] **Step 2: Fix any compilation errors**

Address any TypeScript or import errors that arise.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix: resolve any remaining build issues from feature additions"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| **1: Foundation** | 1-2 | PanelContainer + Store extensions |
| **2: APIs** | 3-9 | 7 new API endpoints (news, social, flights, missile-counts, threat/history, digest, announcements) |
| **3: Sidebar** | 10-15 | AI Assessment, Threat History Chart, Sound Toggle, Connection Indicator, Header Buttons, Announcement Banner |
| **4: Bottom Panels** | 16-23 | BottomPanels layout + 7 panels (News, Defense, Digest, Markets, Social, Missiles, Flights) |
| **5: Playback & Keys** | 24-25 | Enable playback controls, Keyboard shortcuts modal |
| **6: Integration** | 26-28 | Wire up data fetching, Country map labels, Build verification |

**Total: 28 tasks across 6 phases**
