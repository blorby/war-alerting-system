/**
 * Script to generate polygon boundaries for Oref alert areas.
 * Run with: npx tsx scripts/generate-district-polygons.ts
 *
 * Strategy:
 * 1. Fetch all districts from Oref API
 * 2. Group by areaid (~33 unique areas)
 * 3. For each area, try Nominatim for polygon boundaries (with retry on 429)
 * 4. If Nominatim fails or returns a non-polygon, fall back to a convex hull
 *    computed from the district point coordinates in districts.json
 * 5. If only one point exists, create a ~2km circle buffer
 * 6. Output a GeoJSON FeatureCollection to src/lib/geo/district-polygons.geojson
 */

import * as fs from "fs";
import * as path from "path";

interface OrefDistrict {
  id: number;
  label: string;
  label_he: string;
  value: string;
  areaid: number;
  areaname: string;
  miession_id?: number;
  migun_time: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  geojson?: GeoJSON.Geometry;
}

const OREF_DISTRICTS_URL =
  "https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "war-alerting-system/0.1 (polygon-generation)";
const RATE_LIMIT_MS = 1500; // 1.5 seconds between Nominatim requests

const OUTPUT_PATH = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "geo",
  "district-polygons.geojson"
);

const DISTRICTS_JSON_PATH = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "geo",
  "districts.json"
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a circular polygon approximation around a point.
 */
function createCirclePolygon(
  lng: number,
  lat: number,
  radiusKm: number = 2,
  numPoints: number = 32
): GeoJSON.Polygon {
  const coords: [number, number][] = [];
  const degPerKmLng = 1 / (111.32 * Math.cos((lat * Math.PI) / 180));
  const degPerKmLat = 1 / 110.574;

  for (let i = 0; i <= numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    coords.push([
      lng + radiusKm * degPerKmLng * Math.cos(angle),
      lat + radiusKm * degPerKmLat * Math.sin(angle),
    ]);
  }

  return { type: "Polygon", coordinates: [coords] };
}

/**
 * Compute convex hull of a set of 2D points using Andrew's monotone chain.
 */
function convexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;

  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const cross = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove last point of each half because it's repeated
  lower.pop();
  upper.pop();

  const hull = lower.concat(upper);
  // Close the ring
  hull.push(hull[0]);
  return hull;
}

/**
 * Create a polygon from district points using convex hull.
 * If only 1-2 unique points, falls back to circle buffer.
 * Adds a small buffer (~1km) around the hull to make it visible.
 */
function createHullPolygon(
  points: [number, number][]
): GeoJSON.Polygon {
  // Deduplicate points
  const unique = new Map<string, [number, number]>();
  for (const p of points) {
    unique.set(`${p[0].toFixed(6)},${p[1].toFixed(6)}`, p);
  }
  const deduped = [...unique.values()];

  if (deduped.length === 0) {
    return createCirclePolygon(35.2, 31.5); // fallback center of Israel
  }

  if (deduped.length <= 2) {
    // Too few points for a hull, create circle around centroid
    const cLng = deduped.reduce((s, p) => s + p[0], 0) / deduped.length;
    const cLat = deduped.reduce((s, p) => s + p[1], 0) / deduped.length;
    return createCirclePolygon(cLng, cLat, 3);
  }

  const hull = convexHull(deduped);

  // Add small buffer around hull (~1km)
  const centroidLng = hull.reduce((s, p) => s + p[0], 0) / (hull.length - 1);
  const centroidLat = hull.reduce((s, p) => s + p[1], 0) / (hull.length - 1);
  const bufferDeg = 0.01; // ~1km

  const buffered: [number, number][] = hull.map(([lng, lat]) => {
    const dx = lng - centroidLng;
    const dy = lat - centroidLat;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return [lng, lat];
    const scale = (dist + bufferDeg) / dist;
    return [centroidLng + dx * scale, centroidLat + dy * scale] as [number, number];
  });

  return { type: "Polygon", coordinates: [buffered] };
}

async function fetchDistricts(): Promise<OrefDistrict[]> {
  console.log("Fetching districts from Oref...");
  const response = await fetch(OREF_DISTRICTS_URL, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch districts: ${response.status} ${response.statusText}`
    );
  }
  const data = await response.json();
  console.log(`  Fetched ${data.length} districts`);
  return data;
}

async function fetchPolygon(
  areaname: string,
  retries: number = 2
): Promise<{ geometry: GeoJSON.Geometry; source: string } | null> {
  const query = `${areaname}, Israel`;
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&polygon_geojson=1&limit=1`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const backoff = RATE_LIMIT_MS * Math.pow(2, attempt);
      console.log(`    Retry ${attempt}/${retries} after ${backoff}ms...`);
      await sleep(backoff);
    }

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });

    if (response.status === 429) {
      if (attempt < retries) continue;
      return null;
    }

    if (!response.ok) return null;

    const results: NominatimResult[] = await response.json();
    if (results.length === 0) return null;

    const result = results[0];
    const geojson = result.geojson;

    if (
      geojson &&
      (geojson.type === "Polygon" || geojson.type === "MultiPolygon")
    ) {
      return { geometry: geojson, source: "nominatim" };
    }

    // Non-polygon result (Point, LineString, etc.) - return null so caller uses hull
    return null;
  }

  return null;
}

async function main() {
  // 1. Fetch all districts from Oref
  const districts = await fetchDistricts();

  // 2. Load existing districts.json for point coordinates
  const districtsJson: Record<
    string,
    { lat: number; lng: number; areaname: string; migun_time: number }
  > = JSON.parse(fs.readFileSync(DISTRICTS_JSON_PATH, "utf-8"));

  // 3. Build area groups from Oref data
  const areaGroups = new Map<
    number,
    { areaname: string; districtNames: string[] }
  >();

  for (const d of districts) {
    if (!d.areaid || !d.areaname) continue;
    const existing = areaGroups.get(d.areaid);
    if (existing) {
      existing.districtNames.push(d.label_he);
    } else {
      areaGroups.set(d.areaid, {
        areaname: d.areaname,
        districtNames: [d.label_he],
      });
    }
  }

  console.log(`Found ${areaGroups.size} unique areas`);

  // 4. Build point coordinates per area from districts.json
  const areaPoints = new Map<number, [number, number][]>();
  for (const [districtName, entry] of Object.entries(districtsJson)) {
    // Find the areaid for this district
    for (const [areaid, group] of areaGroups) {
      if (group.areaname === entry.areaname) {
        if (!areaPoints.has(areaid)) areaPoints.set(areaid, []);
        areaPoints.get(areaid)!.push([entry.lng, entry.lat]);
        break;
      }
    }
  }

  // 5. Try Nominatim first, fall back to convex hull
  const features: GeoJSON.Feature[] = [];
  let fromNominatim = 0;
  let fromHull = 0;
  let count = 0;

  for (const [areaid, area] of areaGroups) {
    count++;

    // Try Nominatim
    const nominatimResult = await fetchPolygon(area.areaname);

    if (nominatimResult) {
      features.push({
        type: "Feature",
        geometry: nominatimResult.geometry,
        properties: {
          areaid,
          areaname: area.areaname,
          districtNames: area.districtNames,
          geometrySource: "nominatim",
        },
      });
      fromNominatim++;
      console.log(
        `  [${count}/${areaGroups.size}] ${area.areaname} (areaid=${areaid}) -> ${nominatimResult.geometry.type} (nominatim)`
      );
    } else {
      // Fall back to convex hull from district points
      const points = areaPoints.get(areaid) || [];
      const geometry = createHullPolygon(points);
      features.push({
        type: "Feature",
        geometry,
        properties: {
          areaid,
          areaname: area.areaname,
          districtNames: area.districtNames,
          geometrySource: points.length > 2 ? "convex-hull" : "circle-buffer",
        },
      });
      fromHull++;
      const src = points.length > 2 ? "convex-hull" : "circle-buffer";
      console.log(
        `  [${count}/${areaGroups.size}] ${area.areaname} (areaid=${areaid}) -> Polygon (${src}, ${points.length} points)`
      );
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log(
    `\nDone: ${fromNominatim} from Nominatim, ${fromHull} from hull/buffer`
  );

  // 6. Write GeoJSON
  const featureCollection: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features,
  };

  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(featureCollection, null, 2),
    "utf-8"
  );
  console.log(`Wrote ${OUTPUT_PATH} with ${features.length} features`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
