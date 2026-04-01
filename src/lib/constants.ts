import { EventType, Severity, LayerName, FocusArea } from '@/types';

export const EVENT_TYPES = [
  { value: EventType.Alert, label: 'Alert', color: '#ef4444' },
  { value: EventType.Strike, label: 'Strike', color: '#dc2626' },
  { value: EventType.Thermal, label: 'Thermal', color: '#f97316' },
  { value: EventType.Seismic, label: 'Seismic', color: '#8b5cf6' },
  { value: EventType.Flight, label: 'Flight', color: '#3b82f6' },
  { value: EventType.Ship, label: 'Ship', color: '#06b6d4' },
  { value: EventType.News, label: 'News', color: '#14b8a6' },
  { value: EventType.Social, label: 'Social', color: '#22c55e' },
  { value: EventType.Missile, label: 'Missile', color: '#ef4444' },
] as const;

export const SEVERITIES = [
  {
    value: Severity.Critical,
    label: 'Critical',
    color: '#ef4444',
    bgColor: '#ef444420'
  },
  {
    value: Severity.Moderate,
    label: 'Moderate',
    color: '#f97316',
    bgColor: '#f9731620'
  },
  {
    value: Severity.Info,
    label: 'Info',
    color: '#3b82f6',
    bgColor: '#3b82f620'
  },
  {
    value: Severity.Cleared,
    label: 'Cleared',
    color: '#22c55e',
    bgColor: '#22c55e20'
  },
] as const;

export const LAYER_NAMES = [
  { id: 'alerts' as LayerName, label: 'Alerts', color: '#ef4444', defaultEnabled: true },
  { id: 'flights' as LayerName, label: 'Flights', color: '#3b82f6', defaultEnabled: true },
  { id: 'ships' as LayerName, label: 'Ships', color: '#06b6d4', defaultEnabled: true },
  { id: 'strikes' as LayerName, label: 'Strikes', color: '#dc2626', defaultEnabled: true },
  { id: 'seismic' as LayerName, label: 'Seismic', color: '#8b5cf6', defaultEnabled: true },
  { id: 'thermal' as LayerName, label: 'Thermal', color: '#f97316', defaultEnabled: true },
  { id: 'heatmap' as LayerName, label: 'Heatmap', color: '#fbbf24', defaultEnabled: true },
  { id: 'news' as LayerName, label: 'News', color: '#14b8a6', defaultEnabled: true },
  { id: 'missiles' as LayerName, label: 'Missiles', color: '#ef4444', defaultEnabled: true },
  { id: 'social' as LayerName, label: 'Social', color: '#22c55e', defaultEnabled: true },
] as const;

export const FOCUS_AREAS: Record<FocusArea, { label: string; bounds: [[number, number], [number, number]] }> = {
  israel: {
    label: 'Israel',
    bounds: [[34.0, 29.0], [36.5, 33.5]],
  },
  iran: {
    label: 'Iran',
    bounds: [[44.0, 25.0], [63.0, 40.0]],
  },
  gulf: {
    label: 'Persian Gulf',
    bounds: [[47.0, 23.0], [57.0, 31.0]],
  },
  redSea: {
    label: 'Red Sea',
    bounds: [[32.0, 12.0], [44.0, 30.0]],
  },
  region: {
    label: 'Full Region',
    bounds: [[25.0, 12.0], [65.0, 42.0]],
  },
} as const;

export const COUNTRIES = [
  { code: 'IL', name: 'Israel', flag: '🇮🇱' },
  { code: 'IR', name: 'Iran', flag: '🇮🇷' },
  { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
  { code: 'SY', name: 'Syria', flag: '🇸🇾' },
  { code: 'YE', name: 'Yemen', flag: '🇾🇪' },
  { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
  { code: 'PS', name: 'Palestine', flag: '🇵🇸' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
  { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
] as const;

export const MAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export const DEFAULT_CENTER: [number, number] = [35.2, 31.5];

export const DEFAULT_ZOOM = 5;
