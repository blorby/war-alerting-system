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
import { Delaunay } from 'd3-delaunay';

const POLYGONS_URL = 'https://oref-map.pages.dev/locations_polygons.json';
const POINTS_URL = 'https://raw.githubusercontent.com/maorcc/oref-map/main/web/oref_points.json';

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'geo', 'city-polygons.json');
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

// Approximate bounding box for Israel + territories (with padding)
const ISRAEL_BOUNDS: [number, number, number, number] = [34.0, 29.0, 36.5, 33.5]; // [minLng, minLat, maxLng, maxLat]

/**
 * Generate Voronoi polygon features for cities that don't have oref-map polygons.
 * @param points - Map of cityName -> [lng, lat] (already in GeoJSON order)
 * @param existingNames - Set of city names that already have polygons (to skip)
 * @param districts - districts.json data for areaid/migun_time lookup
 */
export function generateVoronoiFeatures(
  points: Record<string, [number, number]>,
  existingNames: Set<string>,
  districts: Record<string, { areaid?: number; migun_time?: number }>,
): GeoJSON.Feature[] {
  // Filter to only cities needing Voronoi cells
  const entries = Object.entries(points).filter(([name]) => !existingNames.has(name));
  if (entries.length === 0) return [];

  const names = entries.map(([name]) => name);
  const coords = entries.map(([, coord]) => coord);

  // Build Delaunay triangulation and Voronoi diagram
  const delaunay = Delaunay.from(coords);
  const voronoi = delaunay.voronoi(ISRAEL_BOUNDS);

  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < names.length; i++) {
    const cell = voronoi.cellPolygon(i);
    if (!cell) continue;

    // cell is already a closed ring of [x, y] points
    const ring: [number, number][] = cell.map(([x, y]) => [x, y] as [number, number]);
    // Ensure closed
    if (ring.length > 0) {
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([...first] as [number, number]);
      }
    }

    const district = districts[names[i]];

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        name: names[i],
        areaid: district?.areaid ?? null,
        migun_time: district?.migun_time ?? null,
        source: 'voronoi',
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

async function main() {
  console.log('Fetching oref-map polygon data...');
  const polygonsData = await fetchJson<Record<string, [number, number][]>>(POLYGONS_URL);
  const polygonKeys = Object.keys(polygonsData).filter((k) => !k.startsWith('_'));
  console.log(`  Got ${polygonKeys.length} polygon entries`);

  console.log('Fetching oref-map point data...');
  const pointsRaw = await fetchJson<Record<string, [number, number]>>(POINTS_URL);
  const pointCount = Object.keys(pointsRaw).length;
  console.log(`  Got ${pointCount} point entries`);

  // Points are [lat, lng] — swap to [lng, lat] for GeoJSON
  const points: Record<string, [number, number]> = {};
  for (const [name, coord] of Object.entries(pointsRaw)) {
    points[name] = swapLatLng(coord);
  }

  console.log('Loading districts.json...');
  const districts: Record<string, { lat: number; lng: number; areaname: string; migun_time: number; areaid: number }> =
    JSON.parse(fs.readFileSync(DISTRICTS_PATH, 'utf-8'));

  // Step 1: Convert oref-map polygons
  console.log('Converting oref-map polygons...');
  const orefMapFeatures = convertOrefMapPolygons(polygonsData, districts);
  console.log(`  Converted ${orefMapFeatures.length} polygon features`);

  // Step 2: Generate Voronoi for gaps
  const existingNames = new Set(orefMapFeatures.map((f) => f.properties!.name as string));
  console.log('Generating Voronoi cells for remaining points...');
  const voronoiFeatures = generateVoronoiFeatures(points, existingNames, districts);
  console.log(`  Generated ${voronoiFeatures.length} Voronoi features`);

  // Step 3: Merge and write GeoJSON
  const allFeatures = [...orefMapFeatures, ...voronoiFeatures];
  const featureCollection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: allFeatures,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(featureCollection, null, 2), 'utf-8');
  console.log(`Wrote ${OUTPUT_PATH} (${allFeatures.length} features)`);

  // Step 4: Update districts.json coordinates from oref_points.json
  let updated = 0;
  for (const [name, entry] of Object.entries(districts)) {
    const point = points[name];
    if (point) {
      entry.lng = point[0];
      entry.lat = point[1];
      updated++;
    }
  }

  fs.writeFileSync(DISTRICTS_PATH, JSON.stringify(districts, null, 2), 'utf-8');
  console.log(`Updated ${updated}/${Object.keys(districts).length} district coordinates`);

  console.log('Done.');
}

// Only run main when executed directly (not imported for tests)
const isDirectRun = process.argv[1]?.endsWith('generate-city-polygons.ts')
  || process.argv[1]?.endsWith('generate-city-polygons.js');

if (isDirectRun) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
