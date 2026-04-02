/**
 * Build script to generate per-city alert zone polygons.
 * Run with: npx tsx scripts/generate-city-polygons.ts
 *
 * 1. Fetches polygon boundaries from oref-map (~450 cities)
 * 2. Fetches per-city centroids from oref-map (~1,200 cities)
 * 3. Generates Voronoi cells for cities without polygon data
 * 4. Clips Voronoi cells to Israel's approximate border
 * 5. Outputs src/lib/geo/city-polygons.geojson
 * 6. Updates src/lib/geo/districts.json with real per-city coordinates
 */

import * as fs from 'fs';
import * as path from 'path';

const POLYGONS_URL = 'https://oref-map.pages.dev/locations_polygons.json';
const POINTS_URL = 'https://raw.githubusercontent.com/maorcc/oref-map/main/web/oref_points.json';

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'geo', 'city-polygons.geojson');
const DISTRICTS_PATH = path.join(__dirname, '..', 'src', 'lib', 'geo', 'districts.json');

/** Swap [lat, lng] to [lng, lat] (oref_points.json uses lat-first). */
export function swapLatLng(coord: [number, number]): [number, number] {
  return [coord[1], coord[0]];
}

/**
 * Convert oref-map polygon entries to GeoJSON features.
 * polygonsData keys are Hebrew city names, values are arrays of [lng, lat] coords.
 */
export function convertOrefMapPolygons(
  polygonsData: Record<string, [number, number][]>,
  districts: Record<string, { areaid?: number; migun_time?: number }>,
): GeoJSON.Feature[] {
  const features: GeoJSON.Feature[] = [];

  for (const [name, coords] of Object.entries(polygonsData)) {
    if (name.startsWith('_')) continue; // skip _copyright etc.
    if (!coords || coords.length < 3) continue;

    // Ensure ring is closed
    const ring = [...coords];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      ring.push([...first] as [number, number]);
    }

    const district = districts[name];

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        name,
        areaid: district?.areaid ?? null,
        migun_time: district?.migun_time ?? null,
        source: 'oref-map',
      },
    });
  }

  return features;
}

// --- Main script (only runs when executed directly, not when imported for tests) ---

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`Fetch failed: ${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

// Voronoi generation is added in Task 3.
// Main execution is added in Task 4.
