import { create } from 'zustand';
import { computeEventCredibility } from '@/lib/credibility';

// --- Data interfaces (JSON wire shapes with ISO string dates) ---

export interface EventData {
  id: string;
  timestamp: string;
  ingestedAt: string;
  type: string;
  severity: 'critical' | 'moderate' | 'info' | 'cleared';
  title: string;
  description: string | null;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  source: string;
  sourceId: string | null;
  metadata: Record<string, unknown>;
  country: string | null;
  isActive: boolean;
  dedupHash: string | null;
  corroborated: boolean;
}

export interface CountryThreatData {
  id: string;
  assessmentId: string;
  countryCode: string;
  countryName: string;
  score: number;
  trend: 'escalating' | 'de-escalating' | 'stable';
  summary: string | null;
}

export interface ThreatData {
  id: string;
  createdAt: string;
  overallScore: number;
  overallTrend: 'escalating' | 'de-escalating' | 'stable';
  situationText: string;
  trendText: string;
  overallText: string;
  countries: CountryThreatData[];
}

export interface TickerItemData {
  id: string;
  text: string;
  type: 'alert' | 'news' | 'thermal' | 'social';
  timestamp: string;
}

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
  missiles: number[];
  uavs: number[];
  totalMissiles: number;
  totalUavs: number;
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

// --- Store state & actions ---

interface AppState {
  events: EventData[];
  threat: ThreatData | null;
  tickerItems: TickerItemData[];
  isLive: boolean;
  lastUpdate: Date | null;

  activeFront: string;
  activeType: string;
  setFront: (front: string) => void;
  setType: (type: string) => void;

  fetchEvents: (opts?: { since?: string }) => Promise<void>;
  fetchThreat: () => Promise<void>;
  fetchTicker: () => Promise<void>;
  connectSSE: () => void;
  disconnectSSE: () => void;

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

  // Credibility filter
  minCredibility: number;
  setMinCredibility: (min: number) => void;

  // Live window filter
  liveWindow: '15m' | '1h' | '3h' | null;
  setLiveWindow: (window: '15m' | '1h' | '3h' | null) => void;

  // Playback state
  playbackTime: Date | null;
  playbackSpeed: number;
  isPlaying: boolean;
  setPlaybackTime: (time: Date | null) => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsPlaying: (playing: boolean) => void;
  goLive: () => void;
  stepForward: (ms: number) => void;
  stepBackward: (ms: number) => void;

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
}

let sseConnection: EventSource | null = null;

let _lastEvents: EventData[] = [];
let _lastFront = '';
let _lastType = '';
let _lastPlaybackTime: Date | null = null;
let _lastLiveWindow: string | null = null;
let _lastMinCredibility = 0;
let _lastResult: EventData[] = [];

export function selectFilteredEvents(state: AppState): EventData[] {
  if (
    state.events === _lastEvents &&
    state.activeFront === _lastFront &&
    state.activeType === _lastType &&
    state.playbackTime === _lastPlaybackTime &&
    state.liveWindow === _lastLiveWindow &&
    state.minCredibility === _lastMinCredibility
  ) {
    return _lastResult;
  }

  _lastEvents = state.events;
  _lastFront = state.activeFront;
  _lastType = state.activeType;
  _lastPlaybackTime = state.playbackTime;
  _lastLiveWindow = state.liveWindow;
  _lastMinCredibility = state.minCredibility;

  let filtered = state.events;

  if (state.activeFront !== 'all') {
    filtered = filtered.filter(e => {
      const s = e.source.toLowerCase();
      const t = e.title.toLowerCase();
      const cat = ((e.metadata?.category as string) || '').toLowerCase();
      switch (state.activeFront) {
        case 'iran': return s.includes('iran') || cat.includes('iran') || e.country === 'IR' || t.includes('iran');
        case 'gaza': return s.includes('gaza') || t.includes('gaza');
        case 'lebanon': return s.includes('lebanon') || t.includes('lebanon') || t.includes('hezbollah');
        case 'west_bank': return s.includes('wafa') || s.includes('maan') || t.includes('west bank');
        case 'internal': return e.country === 'IL' && (s.startsWith('oref') || s.startsWith('telegram-hfc'));
        default: return true;
      }
    });
  }

  if (state.activeType !== 'all') {
    filtered = filtered.filter(e => e.type === state.activeType);
  }

  if (state.playbackTime) {
    const cutoff = state.playbackTime.getTime();
    filtered = filtered.filter(e => new Date(e.timestamp).getTime() <= cutoff);
  }

  // Apply live window filter
  if (!state.playbackTime && state.liveWindow) {
    const windowMs: Record<string, number> = { '15m': 15*60*1000, '1h': 60*60*1000, '3h': 3*60*60*1000 };
    const ms = windowMs[state.liveWindow];
    if (ms) {
      const cutoff = Date.now() - ms;
      filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= cutoff);
    }
  }

  // Apply credibility filter
  if (state.minCredibility > 0) {
    filtered = filtered.filter(e =>
      computeEventCredibility(e.source, e.corroborated) >= state.minCredibility
    );
  }

  _lastResult = filtered;
  return filtered;
}

export const useAppStore = create<AppState>((set, get) => ({
  events: [],
  threat: null,
  tickerItems: [],
  isLive: false,
  lastUpdate: null,

  activeFront: 'all',
  activeType: 'all',
  setFront: (front) => set({ activeFront: front }),
  setType: (type) => set({ activeType: type }),

  fetchEvents: async (opts) => {
    try {
      if (opts?.since) {
        const params = new URLSearchParams({ since: opts.since, limit: '1000' });
        const res = await fetch(`/api/events?${params}`);
        if (!res.ok) return;
        const data = await res.json();
        set((state) => {
          const merged = new Map(state.events.map((e) => [e.id, e]));
          for (const e of data.events ?? []) merged.set(e.id, e);
          const all = [...merged.values()].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          return { events: all.slice(0, 500) };
        });
      } else {
        // Fetch alerts + other events separately so alerts aren't drowned out by flights
        const [alertRes, otherRes] = await Promise.all([
          fetch('/api/events?limit=200&active=true&type=alert'),
          fetch('/api/events?limit=200&active=true'),
        ]);
        const alerts = alertRes.ok ? ((await alertRes.json()).events ?? []) : [];
        const others = otherRes.ok ? ((await otherRes.json()).events ?? []) : [];
        const merged = new Map<string, EventData>();
        for (const e of alerts) merged.set(e.id, e);
        for (const e of others) merged.set(e.id, e);
        const all = [...merged.values()].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        set({ events: all.slice(0, 500) });
      }
    } catch {
      // silently ignore fetch errors
    }
  },

  fetchThreat: async () => {
    try {
      const res = await fetch('/api/threat');
      if (!res.ok) return;
      const data = await res.json();
      set({ threat: data.assessment ?? null, lastUpdate: new Date() });
    } catch {
      // silently ignore fetch errors
    }
  },

  fetchTicker: async () => {
    try {
      const res = await fetch('/api/ticker');
      if (!res.ok) return;
      const data = await res.json();
      set({ tickerItems: data.items ?? [] });
    } catch {
      // silently ignore fetch errors
    }
  },

  connectSSE: () => {
    if (sseConnection) return;

    const es = new EventSource('/api/events/stream');
    sseConnection = es;

    es.onopen = () => {
      set({ isLive: true });
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const newEvents: EventData[] = data.events ?? [];
        if (newEvents.length === 0) return;

        set((state) => {
          const merged = new Map(state.events.map((e) => [e.id, e]));
          for (const e of newEvents) merged.set(e.id, e);
          const all = [...merged.values()].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          return { events: all.slice(0, 500) };
        });

        // Refresh ticker when new events arrive
        get().fetchTicker();
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      set({ isLive: false });
    };
  },

  disconnectSSE: () => {
    if (sseConnection) {
      sseConnection.close();
      sseConnection = null;
    }
    set({ isLive: false });
  },

  news: [],
  socialPosts: [],
  flights: [],
  digest: null,
  missileCounts: null,
  threatHistory: [],
  announcement: null,
  announcementDismissed: false,
  soundEnabled: false,

  minCredibility: 0,
  setMinCredibility: (min) => set({ minCredibility: min }),

  liveWindow: null,
  setLiveWindow: (window) => {
    set({ liveWindow: window });
    if (window) {
      const windowMs: Record<string, number> = { '15m': 15*60*1000, '1h': 60*60*1000, '3h': 3*60*60*1000 };
      const since = new Date(Date.now() - (windowMs[window] ?? 60*60*1000)).toISOString();
      get().fetchEvents({ since });
    }
  },

  playbackTime: null,
  playbackSpeed: 1,
  isPlaying: false,
  setPlaybackTime: (time) => set({ playbackTime: time }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  goLive: () => set({ playbackTime: null, isPlaying: false }),
  stepForward: (ms) => set((s) => {
    const current = s.playbackTime ?? new Date();
    const next = new Date(current.getTime() + ms);
    if (next.getTime() >= Date.now()) {
      return { playbackTime: null, isPlaying: false };
    }
    return { playbackTime: next };
  }),
  stepBackward: (ms) => set((s) => {
    const current = s.playbackTime ?? new Date();
    return { playbackTime: new Date(current.getTime() - ms) };
  }),

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
}));
