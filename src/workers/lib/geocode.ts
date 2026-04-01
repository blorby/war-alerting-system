import { readFileSync } from 'fs';
import { join } from 'path';

// Load city coords lookup at startup
const coordsPath = join(__dirname, '../../lib/geo/city-coords.json');
let cityCoords: Record<string, { lat: number; lng: number }>;
try {
  cityCoords = JSON.parse(readFileSync(coordsPath, 'utf-8'));
} catch {
  cityCoords = {};
  console.warn('[geocode] city-coords.json not found, geocoding disabled');
}

// Sort by name length descending so longer names match first
const sortedNames = Object.keys(cityCoords).sort((a, b) => b.length - a.length);

export function geocodeText(text: string): { lat: number; lng: number; locationName: string } | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const name of sortedNames) {
    const idx = lower.indexOf(name);
    if (idx === -1) continue;

    // Word boundary check
    const before = idx > 0 ? lower[idx - 1] : ' ';
    const after = idx + name.length < lower.length ? lower[idx + name.length] : ' ';
    if (/[a-z]/.test(before) || /[a-z]/.test(after)) continue;

    const coords = cityCoords[name];
    return { lat: coords.lat, lng: coords.lng, locationName: text.substring(idx, idx + name.length) };
  }

  return null;
}
