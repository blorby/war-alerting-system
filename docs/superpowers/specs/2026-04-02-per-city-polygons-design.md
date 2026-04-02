# Per-City Alert Zone Polygons

## Problem

The current polygon system has 1,270 ORef alert zone names but only 29 coarse district-level polygons. All cities within an area share a single coordinate (the area centroid), making per-city polygon rendering and accurate alert matching impossible.

When ORef sends an alert for "אשדוד", the system looks up `areaid: 14` and lights up the entire "דרום השפלה" region — a polygon covering dozens of cities. The reference site (iwm.diskin.net) shows individual city-level polygons.

## Data Sources

### oref-map (maorcc) — Primary
- **Polygons:** `https://oref-map.pages.dev/locations_polygons.json` — ~450 per-city polygons keyed by Hebrew name, coordinate format `[lng, lat]` (GeoJSON-compatible)
- **Points:** `https://raw.githubusercontent.com/maorcc/oref-map/main/web/oref_points.json` — ~1,200 per-city centroids, format `[lat, lng]`
- **License:** MIT (code), copyright Maor Conforti (polygon data)

### Gap Coverage
- ~450 zones have real polygon boundaries from oref-map
- ~750 zones have point coordinates but no polygon — filled via Voronoi tessellation
- ~70 zones may have neither — fall back to area-level polygon highlighting

## Design

### 1. Build Script — `scripts/generate-city-polygons.ts`

**Purpose:** Fetch remote data, generate missing polygons, output committed GeoJSON.

**Steps:**
1. Fetch `locations_polygons.json` (real polygons) and `oref_points.json` (centroids)
2. Load current `districts.json` for areaid/migun_time metadata
3. Convert oref-map polygons to GeoJSON features:
   - Each entry `"cityName": [[lng,lat], ...]` becomes a Feature with `geometry.type: "Polygon"` and `properties: { name, areaid, migun_time }`
4. For zones with a centroid but no polygon:
   - Collect all centroids (from oref_points.json)
   - Run Voronoi tessellation via `d3-delaunay`
   - Clip cells to Israel's approximate border (bounding polygon)
   - Convert cells to GeoJSON features with same property schema
5. Merge real + Voronoi features into single FeatureCollection
6. Write `src/lib/geo/city-polygons.geojson`
7. Update `src/lib/geo/districts.json` — replace the 29 shared coordinates with real per-city centroids from oref_points.json, preserving areaid/areaname/migun_time

**Dependencies:** `d3-delaunay` (dev dependency)

**Run:** `npx tsx scripts/generate-city-polygons.ts` — manual, output committed to repo. No runtime dependency on external APIs.

### 2. Matching Logic — `MapContainer.tsx`

**Current (broken):**
```
event.locationName → districts.json[name].areaid → polygon with areaid
fallback: O(n) proximity scan across 29 identical coordinates
```

**New (direct name lookup):**
```
event.locationName → cityPolygonsByName[name] → set severity on polygon feature
fallback: event.locationName → districts.json[name].areaid → light up all city polygons in that area
```

**Changes to `areaAlertStatus` memo (lines 198-257):**
- Rename to `cityAlertStatus` — `Map<string, string>` keyed by city name instead of `Map<number, string>` keyed by areaid
- For each active security event: `cityAlertStatus.set(event.locationName, severity)`
- Remove `findNearestArea()` — no longer needed
- Keep areaid fallback: if `event.locationName` has no matching polygon, look up its areaid and set severity on all city polygons sharing that areaid

**Changes to `polygonGeojson` memo (lines 576-588):**
- Iterate `city-polygons.geojson` features
- Stamp severity from `cityAlertStatus.get(feature.properties.name)` or fall back to areaid lookup
- Same structure as current, just keyed by name instead of areaid

### 3. Map Rendering — `MapContainer.tsx`

**Architecture unchanged:** One GeoJSON source, two layers (fill + line), data-driven `case` expressions for severity-based coloring.

**Changes:**
- Replace `district-polygons.geojson` import with `city-polygons.geojson`
- Add zoom-dependent visibility for inactive polygons:
  - Zoom <= 7: hide polygons with severity `none` (filter expression)
  - Zoom > 7: show inactive polygon outlines at very low opacity (0.02 fill, 0.1 line)
  - Active alert polygons visible at all zoom levels
- Keep `district-polygons.geojson` as a secondary fallback source/layer at minimal opacity, only used when city-level matching fails

**No changes to:** hit zones, trajectories, heatmap, event circles, event icons, or any other map layer.

### 4. What Doesn't Change

- **ORef worker** (`oref-current.ts`) — already stores Hebrew city names in `event.locationName`
- **Database schema** — no changes
- **SSE/API layer** — no changes
- **Zustand store** — no changes (events already carry `locationName`)
- **Other workers** (Telegram, RSS, GDELT, aviation) — no changes
- **UI components** (filters, timeline, panels) — no changes

## Files Modified

| File | Change |
|------|--------|
| `scripts/generate-city-polygons.ts` | **New** — build script |
| `src/lib/geo/city-polygons.geojson` | **New** — generated per-city polygon data |
| `src/lib/geo/districts.json` | Update coordinates from 29 shared to ~1,200 unique |
| `src/components/map/MapContainer.tsx` | Replace polygon source, rewrite matching logic |
| `package.json` | Add `d3-delaunay` dev dependency |

## Migration

1. Run build script to generate data files
2. Update MapContainer imports and matching
3. Test with live ORef alerts — verify name matching
4. Old `district-polygons.geojson` stays as fallback, can be removed later once coverage is validated
