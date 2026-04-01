export enum EventType {
  Alert = 'alert',
  Strike = 'strike',
  Thermal = 'thermal',
  Seismic = 'seismic',
  Flight = 'flight',
  Ship = 'ship',
  News = 'news',
  Social = 'social',
  Missile = 'missile',
}

export enum Severity {
  Critical = 'critical',
  Moderate = 'moderate',
  Info = 'info',
  Cleared = 'cleared',
}

export interface Event {
  id: string;
  timestamp: Date;
  ingestedAt: Date;
  type: EventType;
  severity: Severity;
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
