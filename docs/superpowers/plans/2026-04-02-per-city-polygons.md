# Per-City Alert Zone Polygons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 29 coarse district polygons with ~1,200 per-city polygons and fix alert-to-polygon matching to use direct name lookup.

**Architecture:** A build script fetches polygon/point data from oref-map, generates Voronoi cells for gaps, and outputs a committed GeoJSON file. MapContainer switches from areaid-based to name-based polygon matching.

**Tech Stack:** d3-delaunay (Voronoi), MapLibre GL, TypeScript, Vitest

---

### Task 1: Add d3-delaunay dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install d3-delaunay as dev dependency**

Run: `npm install --save-dev d3-delaunay @types/d3-delaunay`

- [ ] **Step 2: Verify installation**

Run: `node -e "require('d3-delaunay'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add d3-delaunay for Voronoi polygon generation"
```

---

### Task 2: Build script — fetch and convert oref-map polygons

**Files:**
- Create: `scripts/generate-city-polygons.ts`
- Test: `scripts/generate-city-polygons.test.ts`

This task builds the first half of the script: fetching remote data and converting oref-map polygons to GeoJSON. Voronoi generation is Task 3.

- [ ] **Step 1: Write test for polygon conversion**

Create `scripts/generate-city-polygons.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { convertOrefMapPolygons, swapLatLng } from './generate-city-polygons';

describe('swapLatLng', () => {
  it('swaps [lat, lng] to [lng, lat]', () => {
    expect(swapLatLng([31.5, 35.2])).toEqual([35.2, 31.5]);
  });
});

describe('convertOrefMapPolygons', () => {
  it('converts oref-map polygon entries to GeoJSON features', () => {
    const polygonsData: Record<string, [number, number][]> = {
      'אילת': [[34.95, 29.55], [34.96, 29.56], [34.94, 29.56], [34.95, 29.55]],
    };
    const districts: Record<string, { areaid: number; migun_time: number }> = {
      'אילת': { areaid: 1, migun_time: 30 },
    };

    const features = convertOrefMapPolygons(polygonsData, districts);

    expect(features).toHaveLength(1);
    expect(features[0].properties).toEqual({
      name: 'אילת',
      areaid: 1,
      migun_time: 30,
      source: 'oref-map',
    });
    expect(features[0].geometry.type).toBe('Polygon');
    expect(features[0].geometry.coordinates[0]).toEqual([
      [34.95, 29.55], [34.96, 29.56], [34.94, 29.56], [34.95, 29.55],
    ]);
  });

  it('closes unclosed polygon rings', () => {
    const polygonsData: Record<string, [number, number][]> = {
      'test': [[34.0, 31.0], [34.1, 31.1], [34.0, 31.1]],
    };
    const districts: Record<string, { areaid: number; migun_time: number }> = {};

    const features = convertOrefMapPolygons(polygonsData, districts);
    const coords = features[0].geometry.coordinates[0] as [number, number][];
    expect(coords[0]).toEqual(coords[coords.length - 1]);
  });

  it('skips the _copyright key', () => {
    const polygonsData: Record<string, [number, number][]> = {
      '_copyright': [] as unknown as [number, number][],
      'אילת': [[34.95, 29.55], [34.96, 29.56], [34.94, 29.56], [34.95, 29.55]],
    };
    const districts: Record<string, { areaid: number; migun_time: number }> = {};

    const features = convertOrefMapPolygons(polygonsData, districts);
    expect(features).toHaveLength(1);
    expect(features[0].properties!.name).toBe('אילת');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/generate-city-polygons.test.ts`
Expected: FAIL — cannot import `convertOrefMapPolygons` or `swapLatLng`

- [ ] **Step 3: Write the conversion functions and script skeleton**

Create `scripts/generate-city-polygons.ts`:

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/generate-city-polygons.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-city-polygons.ts scripts/generate-city-polygons.test.ts
git commit -m "feat: add oref-map polygon conversion for build script"
```

---

### Task 3: Build script — Voronoi generation for gap zones

**Files:**
- Modify: `scripts/generate-city-polygons.ts`
- Modify: `scripts/generate-city-polygons.test.ts`

- [ ] **Step 1: Write test for Voronoi generation**

Append to `scripts/generate-city-polygons.test.ts`. Add `generateVoronoiFeatures` to the existing import at the top of the file:

```typescript
import { convertOrefMapPolygons, swapLatLng, generateVoronoiFeatures } from './generate-city-polygons';
```

Then add the new test suite after the existing ones:

```typescript
describe('generateVoronoiFeatures', () => {
  it('generates polygon features for points without existing polygons', () => {
    const points: Record<string, [number, number]> = {
      'cityA': [35.0, 31.0],  // [lng, lat] — already swapped
      'cityB': [35.1, 31.1],
      'cityC': [35.2, 31.0],
    };
    const existingNames = new Set<string>(); // none have polygons yet
    const districts: Record<string, { areaid?: number; migun_time?: number }> = {};

    const features = generateVoronoiFeatures(points, existingNames, districts);

    expect(features).toHaveLength(3);
    for (const f of features) {
      expect(f.geometry.type).toBe('Polygon');
      expect(f.properties!.source).toBe('voronoi');
      // Each polygon should have a closed ring
      const ring = (f.geometry as GeoJSON.Polygon).coordinates[0];
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    }
  });

  it('skips points that already have polygons', () => {
    const points: Record<string, [number, number]> = {
      'cityA': [35.0, 31.0],
      'cityB': [35.1, 31.1],
    };
    const existingNames = new Set(['cityA']);
    const districts: Record<string, { areaid?: number; migun_time?: number }> = {};

    const features = generateVoronoiFeatures(points, existingNames, districts);

    expect(features).toHaveLength(1);
    expect(features[0].properties!.name).toBe('cityB');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/generate-city-polygons.test.ts`
Expected: FAIL — `generateVoronoiFeatures` is not exported

- [ ] **Step 3: Implement Voronoi generation**

Add to `scripts/generate-city-polygons.ts`, after the existing exports:

```typescript
import { Delaunay } from 'd3-delaunay';

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/generate-city-polygons.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-city-polygons.ts scripts/generate-city-polygons.test.ts
git commit -m "feat: add Voronoi cell generation for gap zones"
```

---

### Task 4: Build script — main execution and districts.json update

**Files:**
- Modify: `scripts/generate-city-polygons.ts`

- [ ] **Step 1: Add main function to the build script**

Append to `scripts/generate-city-polygons.ts`, replacing the placeholder comments at the bottom:

```typescript
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
```

- [ ] **Step 2: Run the build script**

Run: `npx tsx scripts/generate-city-polygons.ts`
Expected output: counts of fetched polygons, generated Voronoi cells, written features, updated coordinates.

- [ ] **Step 3: Verify the output**

Run: `node -e "const g = require('./src/lib/geo/city-polygons.geojson'); console.log('Features:', g.features.length); const sources = {}; g.features.forEach(f => { sources[f.properties.source] = (sources[f.properties.source] || 0) + 1; }); console.log('By source:', sources);"`
Expected: ~1,000+ features, mix of `oref-map` and `voronoi` sources.

Run: `node -e "const d = require('./src/lib/geo/districts.json'); const coords = new Set(Object.values(d).map(v => v.lat + ',' + v.lng)); console.log('Unique coordinates:', coords.size);"`
Expected: significantly more than 29 unique coordinates (should be ~1,000+).

- [ ] **Step 4: Run all existing tests to verify no regression**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit generated data and script**

```bash
git add scripts/generate-city-polygons.ts src/lib/geo/city-polygons.geojson src/lib/geo/districts.json
git commit -m "feat: generate per-city polygon data from oref-map + Voronoi"
```

---

### Task 5: Update MapContainer — name-based polygon matching

**Files:**
- Modify: `src/components/map/MapContainer.tsx`

- [ ] **Step 1: Replace polygon import**

In `src/components/map/MapContainer.tsx`, change line 9:

Old:
```typescript
import polygonsData from '@/lib/geo/district-polygons.json';
```

New:
```typescript
import cityPolygonsData from '@/lib/geo/city-polygons.geojson';
```

Note: if the JSON import doesn't resolve `.geojson`, rename the file extension or add a type declaration. Alternatively, import as:
```typescript
import cityPolygonsData from '@/lib/geo/city-polygons.geojson' with { type: 'json' };
```

Check what the existing `district-polygons.json` import uses — the project already has a `.json` duplicate (`district-polygons.json` alongside `.geojson`). Follow the same pattern: if needed, output as `.json` in the build script instead of `.geojson`.

- [ ] **Step 2: Replace `areaAlertStatus` with `cityAlertStatus`**

Replace lines 198-257 in `src/components/map/MapContainer.tsx`:

Old:
```typescript
  const areaAlertStatus = useMemo(() => {
    const districts = districtsData as Record<string, { areaid: number; lat: number; lng: number }>;
    const statusMap = new Map<number, string>();
    const severityRank: Record<string, number> = { critical: 3, moderate: 2, info: 1, cleared: 0 };

    // Build reverse lookup: areaid → center coords (for fallback matching by proximity)
    const areaCenters = new Map<number, { lat: number; lng: number }>();
    for (const d of Object.values(districts)) {
      if (d.areaid && !areaCenters.has(d.areaid)) {
        areaCenters.set(d.areaid, { lat: d.lat, lng: d.lng });
      }
    }

    // Find nearest areaid by lat/lng (within ~15km threshold)
    function findNearestArea(lat: number, lng: number): number | null {
      let bestId: number | null = null;
      let bestDist = 0.15; // ~15km threshold in degrees
      for (const [areaid, center] of areaCenters) {
        const dlat = lat - center.lat;
        const dlng = lng - center.lng;
        const dist = Math.sqrt(dlat * dlat + dlng * dlng);
        if (dist < bestDist) {
          bestDist = dist;
          bestId = areaid;
        }
      }
      return bestId;
    }

    // Security-relevant event types that should trigger polygon highlighting
    const securityTypes = new Set(['alert', 'strike', 'missile', 'thermal']);

    for (const e of allStoreEvents) {
      if (!securityTypes.has(e.type)) continue;

      // Try exact Hebrew name match first
      let areaid: number | undefined;
      if (e.locationName) {
        areaid = districts[e.locationName]?.areaid;
      }

      // Fallback: match by lat/lng proximity
      if (!areaid && e.lat != null && e.lng != null) {
        areaid = findNearestArea(e.lat, e.lng) ?? undefined;
      }

      if (!areaid) continue;

      const current = statusMap.get(areaid);
      const currentRank = current ? (severityRank[current] ?? 0) : -1;
      const newRank = severityRank[e.severity] ?? 0;

      if (e.isActive && newRank > currentRank) {
        statusMap.set(areaid, e.severity);
      } else if (!e.isActive && !statusMap.has(areaid)) {
        statusMap.set(areaid, 'cleared');
      }
    }
    return statusMap;
  }, [allStoreEvents]);
```

New:
```typescript
  const cityAlertStatus = useMemo(() => {
    const districts = districtsData as Record<string, { areaid: number }>;
    const statusMap = new Map<string, string>();   // cityName → severity
    const areaFallback = new Map<number, string>(); // areaid → severity (for unmatched polygons)
    const severityRank: Record<string, number> = { critical: 3, moderate: 2, info: 1, cleared: 0 };

    const securityTypes = new Set(['alert', 'strike', 'missile', 'thermal']);

    for (const e of allStoreEvents) {
      if (!securityTypes.has(e.type)) continue;

      const name = e.locationName;
      if (!name) continue;

      const newRank = severityRank[e.severity] ?? 0;

      // Direct city name match
      if (e.isActive) {
        const current = statusMap.get(name);
        const currentRank = current ? (severityRank[current] ?? 0) : -1;
        if (newRank > currentRank) {
          statusMap.set(name, e.severity);
        }
      } else if (!statusMap.has(name)) {
        statusMap.set(name, 'cleared');
      }

      // Also track areaid for fallback
      const areaid = districts[name]?.areaid;
      if (areaid) {
        if (e.isActive) {
          const currentArea = areaFallback.get(areaid);
          const currentAreaRank = currentArea ? (severityRank[currentArea] ?? 0) : -1;
          if (newRank > currentAreaRank) {
            areaFallback.set(areaid, e.severity);
          }
        } else if (!areaFallback.has(areaid)) {
          areaFallback.set(areaid, 'cleared');
        }
      }
    }

    return { statusMap, areaFallback };
  }, [allStoreEvents]);
```

- [ ] **Step 3: Update `polygonGeojson` memo**

Replace lines 574-588:

Old:
```typescript
  // --- Alert zone polygons (static import, no async fetch) ---
  const polygonGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const base = polygonsData as unknown as GeoJSON.FeatureCollection;
    return {
      type: 'FeatureCollection',
      features: base.features.map((feature) => {
        const areaid = (feature.properties as Record<string, unknown>)?.areaid as number;
        const severity = areaAlertStatus.get(areaid) ?? 'none';
        return {
          ...feature,
          properties: { ...feature.properties, severity },
        };
      }),
    };
  }, [areaAlertStatus]);
```

New:
```typescript
  // --- Alert zone polygons (static import, no async fetch) ---
  const polygonGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const base = cityPolygonsData as unknown as GeoJSON.FeatureCollection;
    const { statusMap, areaFallback } = cityAlertStatus;
    return {
      type: 'FeatureCollection',
      features: base.features.map((feature) => {
        const props = feature.properties as Record<string, unknown>;
        const name = props?.name as string;
        const areaid = props?.areaid as number | null;

        // Try direct city name match first, then areaid fallback
        const severity = statusMap.get(name)
          ?? (areaid ? areaFallback.get(areaid) : undefined)
          ?? 'none';

        return {
          ...feature,
          properties: { ...props, severity },
        };
      }),
    };
  }, [cityAlertStatus]);
```

- [ ] **Step 4: Verify the app builds**

Run: `npm run build`
Expected: Build succeeds with no errors. If the `.geojson` import fails, rename the output file to `.json` in the build script and update the import path.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/MapContainer.tsx
git commit -m "feat: switch to per-city polygon matching by name"
```

---

### Task 6: Update MapContainer — zoom-dependent inactive polygon visibility

**Files:**
- Modify: `src/components/map/MapContainer.tsx`

- [ ] **Step 1: Update fill layer paint to be zoom-dependent for inactive polygons**

In the `useEffect` that adds polygon layers (around line 590-663), update the fill-opacity paint expression.

Old:
```typescript
            'fill-opacity': [
              'case',
              ['==', ['get', 'severity'], 'critical'], 0.45,
              ['==', ['get', 'severity'], 'moderate'], 0.35,
              ['==', ['get', 'severity'], 'info'], 0.25,
              ['==', ['get', 'severity'], 'cleared'], 0.2,
              0.04,
            ] as unknown as maplibregl.ExpressionSpecification,
```

New:
```typescript
            'fill-opacity': [
              'case',
              ['==', ['get', 'severity'], 'critical'], 0.45,
              ['==', ['get', 'severity'], 'moderate'], 0.35,
              ['==', ['get', 'severity'], 'info'], 0.25,
              ['==', ['get', 'severity'], 'cleared'], 0.2,
              // Inactive polygons: invisible at low zoom, faint at high zoom
              ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 0.02],
            ] as unknown as maplibregl.ExpressionSpecification,
```

- [ ] **Step 2: Update line layer paint for inactive polygons**

In the same `useEffect`, update the line-opacity expression.

Old:
```typescript
            'line-opacity': [
              'case',
              ['==', ['get', 'severity'], 'critical'], 0.9,
              ['==', ['get', 'severity'], 'moderate'], 0.7,
              ['==', ['get', 'severity'], 'info'], 0.5,
              ['==', ['get', 'severity'], 'cleared'], 0.4,
              0.2,
            ] as unknown as maplibregl.ExpressionSpecification,
```

New:
```typescript
            'line-opacity': [
              'case',
              ['==', ['get', 'severity'], 'critical'], 0.9,
              ['==', ['get', 'severity'], 'moderate'], 0.7,
              ['==', ['get', 'severity'], 'info'], 0.5,
              ['==', ['get', 'severity'], 'cleared'], 0.4,
              // Inactive: hidden at low zoom, faint outline at high zoom
              ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 0.1],
            ] as unknown as maplibregl.ExpressionSpecification,
```

- [ ] **Step 3: Update line-width for inactive polygons**

Old:
```typescript
            'line-width': [
              'case',
              ['==', ['get', 'severity'], 'none'], 0.8,
              2.5,
            ] as unknown as maplibregl.ExpressionSpecification,
```

New:
```typescript
            'line-width': [
              'case',
              ['==', ['get', 'severity'], 'none'], 0.5,
              2.5,
            ] as unknown as maplibregl.ExpressionSpecification,
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/MapContainer.tsx
git commit -m "feat: zoom-dependent opacity for inactive city polygons"
```

---

### Task 7: Run all tests and visual verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Start dev server and visually verify**

Run: `npm run dev`

Verify in browser:
1. Map loads without errors (check browser console)
2. When no alerts are active: no polygons visible at low zoom, faint outlines visible when zoomed into Israel
3. If ORef alerts are active: individual city polygons light up (not entire districts)
4. Zoom in/out — active polygons stay visible, inactive ones appear/disappear based on zoom

- [ ] **Step 4: Verify polygon count in browser console**

Open browser dev tools and run:
```javascript
// Check how many features are in the polygon source
map.getSource('alert-polygons-source')?.serialize()?.data?.features?.length
```
Expected: ~1,000+ features.

- [ ] **Step 5: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "fix: polygon rendering adjustments from visual testing"
```
