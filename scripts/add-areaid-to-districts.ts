/**
 * One-time script to add areaid to districts.json entries.
 * Run with: npx tsx scripts/add-areaid-to-districts.ts
 *
 * Fetches districts from Oref API, builds a map of label_he -> areaid,
 * and updates each entry in districts.json.
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
  migun_time: number;
}

const OREF_DISTRICTS_URL =
  "https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he";
const USER_AGENT = "war-alerting-system/0.1 (areaid-update)";
const DISTRICTS_PATH = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "geo",
  "districts.json"
);

async function main() {
  // 1. Fetch districts from Oref
  console.log("Fetching districts from Oref...");
  const response = await fetch(OREF_DISTRICTS_URL, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Failed: ${response.status}`);
  }
  const orefDistricts: OrefDistrict[] = await response.json();
  console.log(`  Fetched ${orefDistricts.length} districts`);

  // 2. Build label_he -> areaid map
  const areaidMap = new Map<string, number>();
  for (const d of orefDistricts) {
    if (d.label_he && d.areaid) {
      areaidMap.set(d.label_he, d.areaid);
    }
  }
  console.log(`  Built areaid map with ${areaidMap.size} entries`);

  // 3. Read existing districts.json
  const districtsJson: Record<
    string,
    { lat: number; lng: number; areaname: string; migun_time: number; areaid?: number }
  > = JSON.parse(fs.readFileSync(DISTRICTS_PATH, "utf-8"));
  const total = Object.keys(districtsJson).length;

  // 4. Update each entry with areaid
  let updated = 0;
  let missing = 0;
  for (const [name, entry] of Object.entries(districtsJson)) {
    const areaid = areaidMap.get(name);
    if (areaid !== undefined) {
      entry.areaid = areaid;
      updated++;
    } else {
      missing++;
    }
  }

  console.log(`  Updated ${updated}/${total} entries (${missing} missing areaid)`);

  // 5. Write back
  fs.writeFileSync(DISTRICTS_PATH, JSON.stringify(districtsJson, null, 2), "utf-8");
  console.log(`  Wrote ${DISTRICTS_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
