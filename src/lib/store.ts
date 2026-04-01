import { create } from 'zustand';

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

// --- Store state & actions ---

interface AppState {
  events: EventData[];
  threat: ThreatData | null;
  tickerItems: TickerItemData[];
  isLive: boolean;
  lastUpdate: Date | null;

  fetchEvents: () => Promise<void>;
  fetchThreat: () => Promise<void>;
  fetchTicker: () => Promise<void>;
  connectSSE: () => void;
  disconnectSSE: () => void;
}

let sseConnection: EventSource | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  events: [],
  threat: null,
  tickerItems: [],
  isLive: false,
  lastUpdate: null,

  fetchEvents: async () => {
    try {
      const res = await fetch('/api/events?limit=50&active=true');
      if (!res.ok) return;
      const data = await res.json();
      set({ events: data.events ?? [] });
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
          const merged = [...newEvents, ...state.events].slice(0, 200);
          return { events: merged };
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
}));
