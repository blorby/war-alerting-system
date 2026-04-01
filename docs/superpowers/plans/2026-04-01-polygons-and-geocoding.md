# Alert Polygons & News Geolocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show alert zone polygons on the map when Oref alerts fire, and geolocate news events so they appear on the map at their relevant locations.

**Architecture:** Two independent features. (1) Alert polygons: generate a GeoJSON file of Israeli district polygons using Nominatim, load it as a MapLibre fill layer, and color polygons based on active alert status. (2) News geolocation: add a geocoding step to the news ingestion workers that extracts location names from titles and resolves them to coordinates using a local lookup table + Nominatim fallback.

**Tech Stack:** MapLibre GL (polygon fill/line layers), Nominatim API (geocoding), Node.js scripts, existing Drizzle ORM + PostgreSQL

---

## File Structure

### New Files
```
scripts/generate-district-polygons.ts     — One-time script: fetches polygon boundaries from Nominatim for each Oref area, outputs GeoJSON
src/lib/geo/district-polygons.geojson     — Generated GeoJSON FeatureCollection of district area polygons
src/lib/geo/city-coords.json              — Lookup table of ~200 Middle East city/region names to lat/lng for news geocoding
scripts/generate-city-coords.ts           — One-time script to build the city-coords lookup
src/workers/lib/geocode.ts                — Geocoding helper: resolves location strings to lat/lng using city-coords.json lookup
```

### Modified Files
```
src/components/map/MapContainer.tsx       — Add polygon fill+line layers for alert zones
src/workers/rss-feeds.ts                  — Add geocoding step when creating news events
src/workers/gdelt-collector.ts            — Add geocoding step when creating news events
src/workers/web-scrapers.ts               — Add geocoding step when creating news events
src/lib/geo/districts.json                — Add areaid field to each entry for polygon-district linking
Dockerfile.worker                         — Copy geojson+json data files into worker image
```

---

## Feature A: Alert Zone Polygons

### Task 1: Generate District Area Polygons GeoJSON

**Files:**
- Create: `scripts/generate-district-polygons.ts`
- Create: `src/lib/geo/district-polygons.geojson`

- [ ] **Step 1: Create the polygon generation script**

This script fetches the 33 unique Oref area names, queries Nominatim for their polygon boundaries, and writes a GeoJSON FeatureCollection.

```typescript
/**
 * One-time script to generate district area polygon boundaries.
 * Run with: npx tsx scripts/generate-district-polygons.ts
 *
 * Fetches polygon boundaries from Nominatim for each unique Oref area,
 * then writes src/lib/geo/district-polygons.geojson
 */

import * as fs from 'fs';
import * as path from 'path';

const OREF_DISTRICTS_URL =
  'https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'war-alerting-system/0.1 (polygon-generation)';
const RATE_LIMIT_MS = 1100;
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'geo', 'district-polygons.geojson');

interface OrefDistrict {
  id: string;
  label_he: string;
  areaid: number;
  areaname: string;
  migun_time: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  geojson?: {
    type: string;
    coordinates: unknown;
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDistricts(): Promise<OrefDistrict[]> {
  console.log('Fetching districts from Oref...');
  const res = await fetch(OREF_DISTRICTS_URL, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Failed: ${res.status}`);
  return res.json();
}

async function fetchPolygon(
  areaname: string,
): Promise<{ type: string; coordinates: unknown } | null> {
  const query = `${areaname}, Israel`;
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&polygon_geojson=1&limit=1`;

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    console.warn(`  Nominatim ${res.status} for "${areaname}"`);
    return null;
  }

  const results: NominatimResult[] = await res.json();
  if (!results.length || !results[0].geojson) {
    console.warn(`  No polygon for "${areaname}"`);
    return null;
  }

  const geo = results[0].geojson;
  if (geo.type !== 'Polygon' && geo.type !== 'MultiPolygon') {
    // Nominatim returned a Point — create a small buffer circle instead
    const lat = parseFloat(results[0].lat);
    const lon = parseFloat(results[0].lon);
    const r = 0.02; // ~2km radius in degrees
    const points: [number, number][] = [];
    for (let i = 0; i <= 32; i++) {
      const angle = (i / 32) * 2 * Math.PI;
      points.push([lon + r * Math.cos(angle), lat + r * Math.sin(angle)]);
    }
    return { type: 'Polygon', coordinates: [points] };
  }

  return geo;
}

async function main() {
  const districts = await fetchDistricts();

  // Group districts by areaid to get unique areas
  const areaMap = new Map<number, { areaname: string; districtNames: string[] }>();
  for (const d of districts) {
    if (!areaMap.has(d.areaid)) {
      areaMap.set(d.areaid, { areaname: d.areaname, districtNames: [] });
    }
    areaMap.get(d.areaid)!.districtNames.push(d.label_he);
  }

  console.log(`Found ${areaMap.size} unique areas to fetch polygons for`);

  const features: unknown[] = [];
  let success = 0;
  let failed = 0;

  for (const [areaid, area] of areaMap) {
    const polygon = await fetchPolygon(area.areaname);
    if (polygon) {
      features.push({
        type: 'Feature',
        properties: {
          areaid,
          areaname: area.areaname,
          districtNames: area.districtNames,
        },
        geometry: polygon,
      });
      success++;
      console.log(`  [${success + failed}/${areaMap.size}] ${area.areaname} -> ${polygon.type}`);
    } else {
      failed++;
      console.log(`  [${success + failed}/${areaMap.size}] ${area.areaname} -> FAILED`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  const geojson = {
    type: 'FeatureCollection',
    features,
  };

  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(geojson), 'utf-8');
  console.log(`\nWrote ${OUTPUT_PATH} (${success} polygons, ${failed} failed)`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script to generate polygon data**

```bash
cd /home/blorb/git/war-alerting-system
npx tsx scripts/generate-district-polygons.ts
```

Expected: Creates `src/lib/geo/district-polygons.geojson` with ~33 polygon features. Takes ~40 seconds (33 areas x 1.1s rate limit).

- [ ] **Step 3: Verify the output**

```bash
cat src/lib/geo/district-polygons.geojson | python3 -c "import json,sys;d=json.load(sys.stdin);print(f'{len(d[\"features\"])} polygon features')"
```

Expected: "33 polygon features" (or close to it).

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-district-polygons.ts src/lib/geo/district-polygons.geojson
git commit -m "feat: generate district area polygon boundaries from Nominatim"
```

---

### Task 2: Update Districts JSON with Area IDs

**Files:**
- Modify: `scripts/generate-districts.ts`
- Regenerate: `src/lib/geo/districts.json`

- [ ] **Step 1: Add areaid to the district lookup output**

In `scripts/generate-districts.ts`, the `DistrictEntry` interface and the lookup building section need to include `areaid`. Modify the interface:

```typescript
interface DistrictEntry {
  lat: number;
  lng: number;
  areaname: string;
  areaid: number;
  migun_time: number;
}
```

And in the lookup builder (around line 115), add `areaid`:

```typescript
    lookup[d.label_he] = {
      lat: coords.lat,
      lng: coords.lng,
      areaname: d.areaname,
      areaid: d.areaid,
      migun_time: d.migun_time ?? 0,
    };
```

- [ ] **Step 2: Regenerate districts.json**

```bash
npx tsx scripts/generate-districts.ts
```

This takes a while (1,270 districts x 1.1s = ~23 minutes). Alternatively, we can add areaid to the existing JSON with a quick script:

```bash
npx tsx -e "
const fs = require('fs');
const districts = JSON.parse(fs.readFileSync('src/lib/geo/districts.json','utf-8'));
fetch('https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he')
  .then(r=>r.json())
  .then(oref => {
    const areaMap = {};
    for (const d of oref) { areaMap[d.label_he] = d.areaid; }
    for (const [name, entry] of Object.entries(districts)) {
      entry.areaid = areaMap[name] ?? 0;
    }
    fs.writeFileSync('src/lib/geo/districts.json', JSON.stringify(districts, null, 2));
    console.log('Updated', Object.keys(districts).length, 'entries with areaid');
  });
"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-districts.ts src/lib/geo/districts.json
git commit -m "feat: add areaid to district lookup for polygon linking"
```

---

### Task 3: Render Alert Polygons on Map

**Files:**
- Modify: `src/components/map/MapContainer.tsx`

- [ ] **Step 1: Import and load polygon GeoJSON**

At the top of `MapContainer.tsx`, add an import for the polygon data:

```typescript
import districtPolygons from '@/lib/geo/district-polygons.geojson';
```

If the JSON import doesn't work with Next.js, use a static fetch or inline require. The safest approach is to load it dynamically. Add these constants after the existing ones:

```typescript
const POLYGONS_SOURCE = 'alert-polygons-source';
const POLYGONS_FILL_LAYER = 'alert-polygons-fill';
const POLYGONS_LINE_LAYER = 'alert-polygons-line';
```

- [ ] **Step 2: Build a set of active alert area IDs from events**

Add a `useMemo` that computes which area IDs currently have active alerts. We need the districts lookup. Add an import:

```typescript
import districtsData from '@/lib/geo/districts.json';
```

Then the memo:

```typescript
const activeAreaIds = useMemo(() => {
  const districts = districtsData as Record<string, { areaid: number }>;
  const areaIds = new Set<number>();
  for (const e of events) {
    if (e.type === 'alert' && e.isActive && e.locationName) {
      const district = districts[e.locationName];
      if (district?.areaid) {
        areaIds.add(district.areaid);
      }
    }
  }
  return areaIds;
}, [events]);
```

- [ ] **Step 3: Add polygon layers to the map**

In the map `on('load')` callback (or in a separate useEffect after mapReady), add the polygon source and layers. Add a new `useEffect` after the existing event pins effect:

```typescript
// --- Alert zone polygons ---
useEffect(() => {
  const map = mapRef.current;
  if (!map || !mapReady) return;

  // Load polygon GeoJSON (fetch at runtime to avoid import issues)
  const loadPolygons = async () => {
    let polygonData: GeoJSON.FeatureCollection;
    try {
      const res = await fetch('/district-polygons.geojson');
      polygonData = await res.json();
    } catch {
      return; // Polygon file not available
    }

    // Tag each feature with whether it's active
    for (const feature of polygonData.features) {
      const areaid = (feature.properties as Record<string, unknown>)?.areaid as number;
      (feature.properties as Record<string, unknown>).active = activeAreaIds.has(areaid);
    }

    const source = map.getSource(POLYGONS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(polygonData);
    } else {
      map.addSource(POLYGONS_SOURCE, { type: 'geojson', data: polygonData });

      // Fill layer — colored by active status
      map.addLayer(
        {
          id: POLYGONS_FILL_LAYER,
          type: 'fill',
          source: POLYGONS_SOURCE,
          paint: {
            'fill-color': [
              'case',
              ['get', 'active'],
              '#ef4444', // red for active alerts
              'transparent',
            ] as unknown as maplibregl.ExpressionSpecification,
            'fill-opacity': [
              'case',
              ['get', 'active'],
              0.25,
              0,
            ] as unknown as maplibregl.ExpressionSpecification,
          },
        },
        EVENTS_GLOW_LAYER, // Insert below glow layer
      );

      // Line layer — border for active zones
      map.addLayer(
        {
          id: POLYGONS_LINE_LAYER,
          type: 'line',
          source: POLYGONS_SOURCE,
          paint: {
            'line-color': [
              'case',
              ['get', 'active'],
              '#ef4444',
              'transparent',
            ] as unknown as maplibregl.ExpressionSpecification,
            'line-width': [
              'case',
              ['get', 'active'],
              1.5,
              0,
            ] as unknown as maplibregl.ExpressionSpecification,
            'line-opacity': 0.6,
          },
        },
        EVENTS_GLOW_LAYER,
      );
    }
  };

  loadPolygons();
}, [activeAreaIds, mapReady]);
```

- [ ] **Step 4: Copy the GeoJSON to public/ for static serving**

```bash
cp src/lib/geo/district-polygons.geojson public/district-polygons.geojson
```

- [ ] **Step 5: Verify build**

```bash
npx next build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/components/map/MapContainer.tsx public/district-polygons.geojson
git commit -m "feat: render alert zone polygons on map with active status coloring"
```

---

### Task 4: Support Severity-Based Polygon Colors

**Files:**
- Modify: `src/components/map/MapContainer.tsx`

- [ ] **Step 1: Enhance the activeAreaIds computation to include severity**

Replace the `activeAreaIds` memo with one that tracks severity per area:

```typescript
const areaAlertStatus = useMemo(() => {
  const districts = districtsData as Record<string, { areaid: number }>;
  const statusMap = new Map<number, string>(); // areaid -> worst severity
  const severityRank: Record<string, number> = { critical: 3, moderate: 2, info: 1, cleared: 0 };

  for (const e of events) {
    if (e.type === 'alert' && e.locationName) {
      const district = districts[e.locationName];
      if (!district?.areaid) continue;

      const current = statusMap.get(district.areaid);
      const currentRank = current ? (severityRank[current] ?? 0) : -1;
      const newRank = severityRank[e.severity] ?? 0;

      if (e.isActive && newRank > currentRank) {
        statusMap.set(district.areaid, e.severity);
      } else if (!e.isActive && !statusMap.has(district.areaid)) {
        statusMap.set(district.areaid, 'cleared');
      }
    }
  }
  return statusMap;
}, [events]);
```

- [ ] **Step 2: Update the polygon layer to use severity-based colors**

In the polygon loading effect, update the feature tagging:

```typescript
    for (const feature of polygonData.features) {
      const areaid = (feature.properties as Record<string, unknown>)?.areaid as number;
      const severity = areaAlertStatus.get(areaid) ?? null;
      (feature.properties as Record<string, unknown>).severity = severity;
      (feature.properties as Record<string, unknown>).active = severity !== null && severity !== 'cleared';
    }
```

Update the fill paint to use severity-based colors:

```typescript
            'fill-color': [
              'match',
              ['get', 'severity'],
              'critical', '#ef4444',  // red
              'moderate', '#f97316',  // orange
              'info', '#3b82f6',      // blue
              'cleared', '#22c55e',   // green
              'transparent',
            ] as unknown as maplibregl.ExpressionSpecification,
            'fill-opacity': [
              'match',
              ['get', 'severity'],
              'critical', 0.3,
              'moderate', 0.25,
              'info', 0.15,
              'cleared', 0.1,
              0,
            ] as unknown as maplibregl.ExpressionSpecification,
```

Update the line paint similarly:

```typescript
            'line-color': [
              'match',
              ['get', 'severity'],
              'critical', '#ef4444',
              'moderate', '#f97316',
              'info', '#3b82f6',
              'cleared', '#22c55e',
              'transparent',
            ] as unknown as maplibregl.ExpressionSpecification,
            'line-width': [
              'case',
              ['has', 'severity'],
              1.5,
              0,
            ] as unknown as maplibregl.ExpressionSpecification,
```

Update the useEffect dependency from `activeAreaIds` to `areaAlertStatus`.

- [ ] **Step 3: Commit**

```bash
git add src/components/map/MapContainer.tsx
git commit -m "feat: severity-based polygon coloring (red/orange/blue/green)"
```

---

## Feature B: News Geolocation

### Task 5: Generate City Coordinates Lookup

**Files:**
- Create: `scripts/generate-city-coords.ts`
- Create: `src/lib/geo/city-coords.json`

- [ ] **Step 1: Create the lookup generation script**

This script builds a JSON lookup table of ~200 city/region names commonly appearing in Middle East news, mapped to their coordinates. It uses Nominatim for geocoding.

```typescript
/**
 * One-time script to build a city/region coordinates lookup.
 * Run with: npx tsx scripts/generate-city-coords.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'war-alerting-system/0.1 (city-geocoding)';
const RATE_LIMIT_MS = 1100;
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'geo', 'city-coords.json');

// Cities and regions commonly appearing in Middle East conflict news
const LOCATIONS: { name: string; query: string }[] = [
  // Israel
  { name: 'tel aviv', query: 'Tel Aviv, Israel' },
  { name: 'jerusalem', query: 'Jerusalem, Israel' },
  { name: 'haifa', query: 'Haifa, Israel' },
  { name: 'beer sheva', query: 'Beer Sheva, Israel' },
  { name: 'beersheba', query: 'Beer Sheva, Israel' },
  { name: 'ashdod', query: 'Ashdod, Israel' },
  { name: 'ashkelon', query: 'Ashkelon, Israel' },
  { name: 'eilat', query: 'Eilat, Israel' },
  { name: 'netanya', query: 'Netanya, Israel' },
  { name: 'herzliya', query: 'Herzliya, Israel' },
  { name: 'rishon lezion', query: 'Rishon LeZion, Israel' },
  { name: 'petah tikva', query: 'Petah Tikva, Israel' },
  { name: 'dimona', query: 'Dimona, Israel' },
  { name: 'negev', query: 'Negev, Israel' },
  { name: 'galilee', query: 'Galilee, Israel' },
  { name: 'golan', query: 'Golan Heights' },
  { name: 'sderot', query: 'Sderot, Israel' },
  { name: 'nahariya', query: 'Nahariya, Israel' },
  { name: 'kiryat shmona', query: 'Kiryat Shmona, Israel' },
  { name: 'tiberias', query: 'Tiberias, Israel' },
  { name: 'nazareth', query: 'Nazareth, Israel' },
  { name: 'acre', query: 'Acre, Israel' },
  { name: 'safed', query: 'Safed, Israel' },
  // Palestine
  { name: 'gaza', query: 'Gaza City' },
  { name: 'gaza city', query: 'Gaza City' },
  { name: 'gaza strip', query: 'Gaza Strip' },
  { name: 'khan younis', query: 'Khan Younis' },
  { name: 'khan yunis', query: 'Khan Younis' },
  { name: 'rafah', query: 'Rafah' },
  { name: 'jabalia', query: 'Jabalia' },
  { name: 'nablus', query: 'Nablus' },
  { name: 'ramallah', query: 'Ramallah' },
  { name: 'hebron', query: 'Hebron' },
  { name: 'jenin', query: 'Jenin' },
  { name: 'tulkarm', query: 'Tulkarm' },
  { name: 'bethlehem', query: 'Bethlehem' },
  { name: 'west bank', query: 'West Bank' },
  // Lebanon
  { name: 'beirut', query: 'Beirut, Lebanon' },
  { name: 'tyre', query: 'Tyre, Lebanon' },
  { name: 'sidon', query: 'Sidon, Lebanon' },
  { name: 'nabatieh', query: 'Nabatieh, Lebanon' },
  { name: 'baalbek', query: 'Baalbek, Lebanon' },
  { name: 'tripoli', query: 'Tripoli, Lebanon' },
  { name: 'south lebanon', query: 'South Lebanon' },
  { name: 'bekaa', query: 'Bekaa Valley, Lebanon' },
  // Syria
  { name: 'damascus', query: 'Damascus, Syria' },
  { name: 'aleppo', query: 'Aleppo, Syria' },
  { name: 'homs', query: 'Homs, Syria' },
  { name: 'latakia', query: 'Latakia, Syria' },
  { name: 'deir ez-zor', query: 'Deir ez-Zor, Syria' },
  { name: 'idlib', query: 'Idlib, Syria' },
  { name: 'daraa', query: 'Daraa, Syria' },
  // Iran
  { name: 'tehran', query: 'Tehran, Iran' },
  { name: 'isfahan', query: 'Isfahan, Iran' },
  { name: 'natanz', query: 'Natanz, Iran' },
  { name: 'shiraz', query: 'Shiraz, Iran' },
  { name: 'tabriz', query: 'Tabriz, Iran' },
  { name: 'mashhad', query: 'Mashhad, Iran' },
  { name: 'bandar abbas', query: 'Bandar Abbas, Iran' },
  { name: 'bushehr', query: 'Bushehr, Iran' },
  { name: 'qom', query: 'Qom, Iran' },
  { name: 'kashan', query: 'Kashan, Iran' },
  { name: 'arak', query: 'Arak, Iran' },
  { name: 'fordow', query: 'Fordow, Iran' },
  { name: 'parchin', query: 'Parchin, Iran' },
  { name: 'kharg island', query: 'Kharg Island, Iran' },
  { name: 'chabahar', query: 'Chabahar, Iran' },
  // Iraq
  { name: 'baghdad', query: 'Baghdad, Iraq' },
  { name: 'basra', query: 'Basra, Iraq' },
  { name: 'erbil', query: 'Erbil, Iraq' },
  { name: 'mosul', query: 'Mosul, Iraq' },
  { name: 'kirkuk', query: 'Kirkuk, Iraq' },
  // Yemen
  { name: 'sanaa', query: 'Sanaa, Yemen' },
  { name: 'aden', query: 'Aden, Yemen' },
  { name: 'hodeidah', query: 'Hodeidah, Yemen' },
  { name: 'marib', query: 'Marib, Yemen' },
  // Gulf
  { name: 'riyadh', query: 'Riyadh, Saudi Arabia' },
  { name: 'jeddah', query: 'Jeddah, Saudi Arabia' },
  { name: 'dubai', query: 'Dubai, UAE' },
  { name: 'abu dhabi', query: 'Abu Dhabi, UAE' },
  { name: 'doha', query: 'Doha, Qatar' },
  { name: 'manama', query: 'Manama, Bahrain' },
  { name: 'kuwait city', query: 'Kuwait City, Kuwait' },
  { name: 'muscat', query: 'Muscat, Oman' },
  // Jordan / Egypt
  { name: 'amman', query: 'Amman, Jordan' },
  { name: 'cairo', query: 'Cairo, Egypt' },
  { name: 'sinai', query: 'Sinai Peninsula' },
  // Turkey
  { name: 'ankara', query: 'Ankara, Turkey' },
  { name: 'istanbul', query: 'Istanbul, Turkey' },
  // Regions / waterways
  { name: 'strait of hormuz', query: 'Strait of Hormuz' },
  { name: 'red sea', query: 'Red Sea' },
  { name: 'persian gulf', query: 'Persian Gulf' },
  { name: 'suez canal', query: 'Suez Canal' },
  { name: 'bab al-mandab', query: 'Bab el-Mandeb' },
  // Countries (fallback — center point)
  { name: 'israel', query: 'Israel' },
  { name: 'iran', query: 'Iran' },
  { name: 'lebanon', query: 'Lebanon' },
  { name: 'syria', query: 'Syria' },
  { name: 'iraq', query: 'Iraq' },
  { name: 'yemen', query: 'Yemen' },
  { name: 'saudi arabia', query: 'Saudi Arabia' },
  { name: 'bahrain', query: 'Bahrain' },
  { name: 'qatar', query: 'Qatar' },
  { name: 'jordan', query: 'Jordan' },
  { name: 'egypt', query: 'Egypt' },
  { name: 'turkey', query: 'Turkey' },
  { name: 'uae', query: 'United Arab Emirates' },
  { name: 'united arab emirates', query: 'United Arab Emirates' },
  { name: 'kuwait', query: 'Kuwait' },
  { name: 'oman', query: 'Oman' },
  { name: 'pakistan', query: 'Pakistan' },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface NominatimResult {
  lat: string;
  lon: string;
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) return null;
  const results: NominatimResult[] = await res.json();
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
}

async function main() {
  const lookup: Record<string, { lat: number; lng: number }> = {};
  let success = 0;
  let failed = 0;

  for (const loc of LOCATIONS) {
    const coords = await geocode(loc.query);
    if (coords) {
      lookup[loc.name] = coords;
      success++;
      console.log(`[${success + failed}/${LOCATIONS.length}] ${loc.name} -> ${coords.lat}, ${coords.lng}`);
    } else {
      failed++;
      console.log(`[${success + failed}/${LOCATIONS.length}] ${loc.name} -> FAILED`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(lookup, null, 2), 'utf-8');
  console.log(`\nWrote ${OUTPUT_PATH} (${success} entries, ${failed} failed)`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run the script**

```bash
npx tsx scripts/generate-city-coords.ts
```

Expected: Creates `src/lib/geo/city-coords.json` with ~100 entries. Takes ~2 minutes.

- [ ] **Step 3: Commit**

```bash
git add scripts/generate-city-coords.ts src/lib/geo/city-coords.json
git commit -m "feat: generate city coordinates lookup for news geocoding"
```

---

### Task 6: Create Geocoding Helper

**Files:**
- Create: `src/workers/lib/geocode.ts`

- [ ] **Step 1: Create the geocoding module**

This module takes a news title/description and attempts to extract a location, then returns coordinates from the lookup table.

```typescript
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
// e.g., "khan younis" before "khan", "gaza strip" before "gaza"
const sortedNames = Object.keys(cityCoords).sort((a, b) => b.length - a.length);

/**
 * Attempts to extract a geographic location from a text string (title/description)
 * and return its coordinates. Returns null if no location found.
 */
export function geocodeText(text: string): { lat: number; lng: number; locationName: string } | null {
  if (!text) return null;

  const lower = text.toLowerCase();

  for (const name of sortedNames) {
    // Word boundary check: the name must appear as a whole word/phrase
    const idx = lower.indexOf(name);
    if (idx === -1) continue;

    // Check boundaries: before must be start-of-string or non-alpha, after must be end-of-string or non-alpha
    const before = idx > 0 ? lower[idx - 1] : ' ';
    const after = idx + name.length < lower.length ? lower[idx + name.length] : ' ';

    if (/[a-z]/.test(before) || /[a-z]/.test(after)) continue;

    const coords = cityCoords[name];
    return {
      lat: coords.lat,
      lng: coords.lng,
      locationName: text.substring(idx, idx + name.length),
    };
  }

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/workers/lib/geocode.ts
git commit -m "feat: add geocoding helper for news location extraction"
```

---

### Task 7: Add Geocoding to RSS Feeds Worker

**Files:**
- Modify: `src/workers/rss-feeds.ts`

- [ ] **Step 1: Add geocoding to itemToEvent**

At the top of `src/workers/rss-feeds.ts`, add the import:

```typescript
import { geocodeText } from './lib/geocode';
```

In the `itemToEvent` function, after creating the description, add geocoding:

```typescript
function itemToEvent(item: Parser.Item, feedConfig: RssFeedConfig): NewEvent {
  const sourceId = item.guid || item.link || '';
  const description = (item.contentSnippet || item.content || '').slice(0, 500) || null;

  // Attempt to geolocate from title and description
  const geo = geocodeText(item.title || '') || geocodeText(description || '');

  return {
    timestamp: parseItemDate(item),
    type: 'news',
    severity: 'info',
    title: item.title || '(untitled)',
    description,
    locationName: geo?.locationName ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    source: feedConfig.source,
    sourceId,
    country: null,
    dedupHash: rssDedupHash(feedConfig.source, sourceId),
    metadata: {
      category: feedConfig.category,
      feedUrl: feedConfig.url,
      link: item.link,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/workers/rss-feeds.ts
git commit -m "feat: geocode RSS news items from title/description"
```

---

### Task 8: Add Geocoding to GDELT Collector

**Files:**
- Modify: `src/workers/gdelt-collector.ts`

- [ ] **Step 1: Add geocoding to articleToEvent**

At the top of `src/workers/gdelt-collector.ts`, add:

```typescript
import { geocodeText } from './lib/geocode';
```

In `articleToEvent`, add geocoding:

```typescript
function articleToEvent(article: GdeltArticle): NewEvent {
  const sourceId = `gdelt:${article.url}`;

  // Attempt to geolocate from title
  const geo = geocodeText(article.title || '');

  return {
    timestamp: parseSeenDate(article.seendate),
    type: 'news',
    severity: 'info',
    title: article.title || '(untitled)',
    description: article.domain ? `Source: ${article.domain}` : null,
    locationName: geo?.locationName ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    source: 'gdelt',
    sourceId,
    country: null,
    dedupHash: sha256(sourceId),
    metadata: {
      url: article.url,
      domain: article.domain,
      language: article.language,
      sourcecountry: article.sourcecountry,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/workers/gdelt-collector.ts
git commit -m "feat: geocode GDELT news articles from titles"
```

---

### Task 9: Add Geocoding to Web Scrapers

**Files:**
- Modify: `src/workers/web-scrapers.ts`

- [ ] **Step 1: Add geocoding to itemToEvent**

At the top of `src/workers/web-scrapers.ts`, add:

```typescript
import { geocodeText } from './lib/geocode';
```

In `itemToEvent`, add geocoding:

```typescript
function itemToEvent(item: ScrapedItem, site: ScraperSiteConfig): NewEvent {
  // Attempt to geolocate from title and snippet
  const geo = geocodeText(item.title || '') || geocodeText(item.snippet || '');

  return {
    timestamp: item.date || new Date(),
    type: 'news',
    severity: 'info',
    title: item.title,
    description: item.snippet?.slice(0, 500) || null,
    locationName: geo?.locationName ?? null,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
    source: site.source,
    sourceId: `scraper:${site.source}:${item.url}`,
    country: site.country,
    dedupHash: scraperDedupHash(site.source, item.url),
    metadata: {
      category: site.category,
      siteUrl: site.url,
      itemUrl: item.url,
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/workers/web-scrapers.ts
git commit -m "feat: geocode web-scraped news items from titles"
```

---

### Task 10: Update Dockerfile.worker for Data Files

**Files:**
- Modify: `Dockerfile.worker`

- [ ] **Step 1: Ensure geo data files are copied into the worker image**

Read the current Dockerfile.worker. Add a COPY step for the geo data files that the workers need at runtime. The `geocode.ts` module reads `city-coords.json` from a relative path. After the TypeScript compilation step, add:

```dockerfile
COPY src/lib/geo/city-coords.json dist/lib/geo/city-coords.json
COPY src/lib/geo/districts.json dist/lib/geo/districts.json
```

- [ ] **Step 2: Commit**

```bash
git add Dockerfile.worker
git commit -m "fix: copy geo data files into worker Docker image"
```

---

### Task 11: Rebuild Workers and Verify

- [ ] **Step 1: Rebuild all worker containers**

```bash
cd /home/blorb/git/war-alerting-system
docker compose up -d --build --force-recreate worker-rss-feeds worker-gdelt worker-web-scrapers
```

- [ ] **Step 2: Rebuild nextjs container**

```bash
docker compose up -d --build --force-recreate nextjs
```

- [ ] **Step 3: Verify news events are getting coordinates**

Wait 10-15 minutes for the RSS/GDELT/web scraper workers to run a cycle, then:

```bash
curl -s 'http://localhost:3004/api/events?limit=10&type=news' | python3 -c "
import json, sys
d = json.load(sys.stdin)
with_coords = sum(1 for e in d['events'] if e.get('lat'))
print(f'{with_coords}/{len(d[\"events\"])} news events have coordinates')
for e in d['events'][:3]:
    print(f'  {e[\"title\"][:60]} -> {e.get(\"locationName\")}: {e.get(\"lat\")}, {e.get(\"lng\")}')
"
```

- [ ] **Step 4: Verify polygons load on map**

Open `http://localhost:3004` in browser. If there are active Oref alerts, you should see colored polygon zones on the Israel area of the map.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete alert polygons and news geolocation"
```

---

## Summary

| Task | Feature | What it does |
|------|---------|-------------|
| 1 | Polygons | Generate district area polygon GeoJSON from Nominatim |
| 2 | Polygons | Add areaid to districts.json for polygon-district linking |
| 3 | Polygons | Render fill+line polygon layers on MapLibre map |
| 4 | Polygons | Severity-based polygon coloring (red/orange/blue/green) |
| 5 | Geocoding | Generate city coordinates lookup (~100 Middle East cities) |
| 6 | Geocoding | Create geocoding helper (title text -> lat/lng lookup) |
| 7 | Geocoding | Add geocoding to RSS feeds worker |
| 8 | Geocoding | Add geocoding to GDELT collector |
| 9 | Geocoding | Add geocoding to web scrapers worker |
| 10 | Both | Update Dockerfile.worker to include geo data files |
| 11 | Both | Rebuild, verify polygons and geocoded news on map |

**Total: 11 tasks across 2 features**
