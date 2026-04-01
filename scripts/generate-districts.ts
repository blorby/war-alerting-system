/**
 * One-time script to geocode Oref district names.
 * Run with: npx tsx scripts/generate-districts.ts
 *
 * Fetches all districts from Oref, extracts unique area names,
 * geocodes each via OpenStreetMap Nominatim, and writes the
 * result to src/lib/geo/districts.json.
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
}

interface DistrictEntry {
  lat: number;
  lng: number;
  areaname: string;
  migun_time: number;
}

const OREF_DISTRICTS_URL =
  "https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "war-alerting-system/0.1 (geocoding districts)";
const RATE_LIMIT_MS = 1100; // 1.1 seconds between Nominatim requests
const OUTPUT_PATH = path.join(
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

async function geocodeArea(
  areaname: string
): Promise<{ lat: number; lng: number } | null> {
  const query = `${areaname}, Israel`;
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    console.warn(
      `  Warning: Nominatim returned ${response.status} for "${areaname}"`
    );
    return null;
  }

  const results: NominatimResult[] = await response.json();
  if (results.length === 0) {
    console.warn(`  Warning: No geocoding result for "${areaname}"`);
    return null;
  }

  return {
    lat: parseFloat(results[0].lat),
    lng: parseFloat(results[0].lon),
  };
}

async function main() {
  // 1. Fetch all districts
  const districts = await fetchDistricts();

  // 2. Extract unique area names
  const uniqueAreas = new Set<string>();
  for (const d of districts) {
    if (d.areaname) {
      uniqueAreas.add(d.areaname);
    }
  }
  console.log(`Found ${uniqueAreas.size} unique area names to geocode`);

  // 3. Geocode each unique area name
  const areaCoords: Record<string, { lat: number; lng: number }> = {};
  let geocoded = 0;
  let failed = 0;

  for (const areaname of uniqueAreas) {
    const coords = await geocodeArea(areaname);
    if (coords) {
      areaCoords[areaname] = coords;
      geocoded++;
      console.log(
        `  [${geocoded + failed}/${uniqueAreas.size}] ${areaname} -> ${coords.lat}, ${coords.lng}`
      );
    } else {
      failed++;
      console.log(
        `  [${geocoded + failed}/${uniqueAreas.size}] ${areaname} -> FAILED`
      );
    }
    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nGeocoded ${geocoded}/${uniqueAreas.size} areas (${failed} failed)`);

  // 4. Build district lookup: label_he -> coords from areaname
  const lookup: Record<string, DistrictEntry> = {};

  for (const d of districts) {
    if (!d.label_he) continue;

    const coords = d.areaname ? areaCoords[d.areaname] : null;
    if (coords) {
      lookup[d.label_he] = {
        lat: coords.lat,
        lng: coords.lng,
        areaname: d.areaname,
        migun_time: d.migun_time ?? 0,
      };
    }
  }

  console.log(`Built lookup with ${Object.keys(lookup).length} district entries`);

  // 5. Write to districts.json
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(lookup, null, 2), "utf-8");
  console.log(`\nWrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
