/**
 * Generate city-coords.json by geocoding Middle East conflict-related locations
 * via Nominatim (OpenStreetMap), with hardcoded fallbacks for reliability.
 *
 * Usage: npx tsx scripts/generate-city-coords.ts
 *
 * Rate limit: 1.5s between Nominatim requests per usage policy.
 * If Nominatim is unavailable or rate-limited, fallback coords are used.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const USER_AGENT = 'war-alerting-system/0.1 (city-geocoding)';
const RATE_LIMIT_MS = 1500;
const OUTPUT_PATH = join(__dirname, '../src/lib/geo/city-coords.json');

// ── Fallback coordinates (sourced from OpenStreetMap/Wikipedia) ────────────
// Used when Nominatim is rate-limited or unavailable.

const FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  // Israel
  'tel aviv': { lat: 32.0853, lng: 34.7818 },
  'jerusalem': { lat: 31.7683, lng: 35.2137 },
  'haifa': { lat: 32.7940, lng: 34.9896 },
  'beer sheva': { lat: 31.2530, lng: 34.7915 },
  'beersheba': { lat: 31.2530, lng: 34.7915 },
  'ashdod': { lat: 31.8044, lng: 34.6553 },
  'ashkelon': { lat: 31.6688, lng: 34.5743 },
  'eilat': { lat: 29.5577, lng: 34.9519 },
  'netanya': { lat: 32.3215, lng: 34.8532 },
  'herzliya': { lat: 32.1629, lng: 34.8447 },
  'dimona': { lat: 31.0680, lng: 35.0338 },
  'negev': { lat: 30.8500, lng: 34.7500 },
  'galilee': { lat: 32.8000, lng: 35.5000 },
  'golan': { lat: 33.0000, lng: 35.7500 },
  'sderot': { lat: 31.5250, lng: 34.5964 },
  'nahariya': { lat: 33.0058, lng: 35.0981 },
  'kiryat shmona': { lat: 33.2075, lng: 35.5731 },
  'tiberias': { lat: 32.7922, lng: 35.5312 },
  'nazareth': { lat: 32.6996, lng: 35.3035 },
  'acre': { lat: 32.9278, lng: 35.0764 },
  'safed': { lat: 32.9646, lng: 35.4960 },
  'krayot': { lat: 32.8400, lng: 35.0700 },
  'rishon lezion': { lat: 31.9642, lng: 34.8045 },
  'petah tikva': { lat: 32.0868, lng: 34.8874 },
  'rehovot': { lat: 31.8928, lng: 34.8113 },
  'modiin': { lat: 31.8969, lng: 35.0104 },
  'ramat gan': { lat: 32.0700, lng: 34.8236 },
  'bnei brak': { lat: 32.0833, lng: 34.8333 },

  // Palestine
  'gaza': { lat: 31.5017, lng: 34.4668 },
  'gaza city': { lat: 31.5017, lng: 34.4668 },
  'gaza strip': { lat: 31.3547, lng: 34.3088 },
  'khan younis': { lat: 31.3462, lng: 34.3060 },
  'khan yunis': { lat: 31.3462, lng: 34.3060 },
  'rafah': { lat: 31.2969, lng: 34.2455 },
  'jabalia': { lat: 31.5281, lng: 34.4831 },
  'nablus': { lat: 32.2211, lng: 35.2544 },
  'ramallah': { lat: 31.9038, lng: 35.2034 },
  'hebron': { lat: 31.5326, lng: 35.0998 },
  'jenin': { lat: 32.4610, lng: 35.3027 },
  'tulkarm': { lat: 32.3104, lng: 35.0286 },
  'bethlehem': { lat: 31.7054, lng: 35.2024 },
  'west bank': { lat: 31.9466, lng: 35.3027 },
  'jericho': { lat: 31.8611, lng: 35.4606 },
  'deir al-balah': { lat: 31.4167, lng: 34.3500 },

  // Lebanon
  'beirut': { lat: 33.8938, lng: 35.5018 },
  'tyre': { lat: 33.2705, lng: 35.2038 },
  'sidon': { lat: 33.5633, lng: 35.3756 },
  'nabatieh': { lat: 33.3778, lng: 35.4836 },
  'baalbek': { lat: 34.0065, lng: 36.2181 },
  'tripoli': { lat: 34.4332, lng: 35.8499 },
  'south lebanon': { lat: 33.2700, lng: 35.3700 },
  'bekaa': { lat: 33.8500, lng: 35.9000 },
  'dahiyeh': { lat: 33.8600, lng: 35.5100 },
  'marjayoun': { lat: 33.3606, lng: 35.5917 },

  // Syria
  'damascus': { lat: 33.5138, lng: 36.2765 },
  'aleppo': { lat: 36.2021, lng: 37.1343 },
  'homs': { lat: 34.7325, lng: 36.7106 },
  'latakia': { lat: 35.5317, lng: 35.7917 },
  'deir ez-zor': { lat: 35.3359, lng: 40.1408 },
  'idlib': { lat: 35.9306, lng: 36.6339 },
  'daraa': { lat: 32.6189, lng: 36.1021 },
  'raqqa': { lat: 35.9528, lng: 39.0100 },
  'palmyra': { lat: 34.5503, lng: 38.2691 },

  // Iran
  'tehran': { lat: 35.6892, lng: 51.3890 },
  'isfahan': { lat: 32.6546, lng: 51.6680 },
  'natanz': { lat: 33.5114, lng: 51.9175 },
  'shiraz': { lat: 29.5918, lng: 52.5837 },
  'tabriz': { lat: 38.0800, lng: 46.2919 },
  'mashhad': { lat: 36.2972, lng: 59.6067 },
  'bandar abbas': { lat: 27.1865, lng: 56.2808 },
  'bushehr': { lat: 28.9234, lng: 50.8203 },
  'qom': { lat: 34.6401, lng: 50.8764 },
  'kashan': { lat: 33.9850, lng: 51.4100 },
  'arak': { lat: 34.0917, lng: 49.6892 },
  'fordow': { lat: 34.7080, lng: 51.2390 },
  'parchin': { lat: 35.5203, lng: 51.7700 },
  'kharg island': { lat: 29.2333, lng: 50.3167 },
  'chabahar': { lat: 25.2919, lng: 60.6430 },
  'abadan': { lat: 30.3392, lng: 48.3043 },
  'ahvaz': { lat: 31.3183, lng: 48.6706 },
  'kermanshah': { lat: 34.3142, lng: 47.0650 },
  'yazd': { lat: 31.8974, lng: 54.3569 },

  // Iraq
  'baghdad': { lat: 33.3152, lng: 44.3661 },
  'basra': { lat: 30.5085, lng: 47.7804 },
  'erbil': { lat: 36.1912, lng: 44.0119 },
  'mosul': { lat: 36.3350, lng: 43.1189 },
  'kirkuk': { lat: 35.4681, lng: 44.3953 },
  'fallujah': { lat: 33.3481, lng: 43.7831 },
  'najaf': { lat: 32.0000, lng: 44.3348 },
  'karbala': { lat: 32.6160, lng: 44.0249 },

  // Yemen
  'sanaa': { lat: 15.3694, lng: 44.1910 },
  'aden': { lat: 12.7855, lng: 45.0187 },
  'hodeidah': { lat: 14.7979, lng: 42.9544 },
  'marib': { lat: 15.4543, lng: 45.3269 },
  'taiz': { lat: 13.5789, lng: 44.0219 },

  // Gulf
  'riyadh': { lat: 24.7136, lng: 46.6753 },
  'jeddah': { lat: 21.4858, lng: 39.1925 },
  'mecca': { lat: 21.3891, lng: 39.8579 },
  'medina': { lat: 24.4539, lng: 39.6142 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'abu dhabi': { lat: 24.4539, lng: 54.3773 },
  'doha': { lat: 25.2854, lng: 51.5310 },
  'manama': { lat: 26.2235, lng: 50.5876 },
  'kuwait city': { lat: 29.3759, lng: 47.9774 },
  'muscat': { lat: 23.5880, lng: 58.3829 },

  // Jordan / Egypt / Turkey
  'amman': { lat: 31.9454, lng: 35.9284 },
  'cairo': { lat: 30.0444, lng: 31.2357 },
  'sinai': { lat: 29.5000, lng: 34.0000 },
  'alexandria': { lat: 31.2001, lng: 29.9187 },
  'ankara': { lat: 39.9334, lng: 32.8597 },
  'istanbul': { lat: 41.0082, lng: 28.9784 },
  'incirlik': { lat: 37.0017, lng: 35.4253 },

  // Regions / waterways
  'strait of hormuz': { lat: 26.5667, lng: 56.2500 },
  'red sea': { lat: 20.0000, lng: 38.0000 },
  'persian gulf': { lat: 26.0000, lng: 52.0000 },
  'suez canal': { lat: 30.4550, lng: 32.3499 },
  'bab al-mandab': { lat: 12.5833, lng: 43.3333 },
  'mediterranean': { lat: 35.0000, lng: 18.0000 },

  // Countries (fallback centroids)
  'israel': { lat: 31.0461, lng: 34.8516 },
  'iran': { lat: 32.4279, lng: 53.6880 },
  'lebanon': { lat: 33.8547, lng: 35.8623 },
  'syria': { lat: 34.8021, lng: 38.9968 },
  'iraq': { lat: 33.2232, lng: 43.6793 },
  'yemen': { lat: 15.5527, lng: 48.5164 },
  'saudi arabia': { lat: 23.8859, lng: 45.0792 },
  'bahrain': { lat: 26.0667, lng: 50.5577 },
  'qatar': { lat: 25.3548, lng: 51.1839 },
  'jordan': { lat: 30.5852, lng: 36.2384 },
  'egypt': { lat: 26.8206, lng: 30.8025 },
  'turkey': { lat: 38.9637, lng: 35.2433 },
  'uae': { lat: 23.4241, lng: 53.8478 },
  'united arab emirates': { lat: 23.4241, lng: 53.8478 },
  'kuwait': { lat: 29.3117, lng: 47.4818 },
  'oman': { lat: 21.4735, lng: 55.9754 },
  'pakistan': { lat: 30.3753, lng: 69.3451 },
};

// ── Nominatim search hints ─────────────────────────────────────────────────

interface LocationHint {
  q?: string;
  countrycodes?: string;
}

const NOMINATIM_HINTS: Record<string, LocationHint> = {
  'tel aviv': { countrycodes: 'il' },
  'jerusalem': { countrycodes: 'il' },
  'haifa': { countrycodes: 'il' },
  'beer sheva': { q: 'Beer Sheva, Israel' },
  'beersheba': { q: 'Beersheba, Israel' },
  'ashdod': { countrycodes: 'il' },
  'ashkelon': { countrycodes: 'il' },
  'eilat': { countrycodes: 'il' },
  'netanya': { countrycodes: 'il' },
  'herzliya': { countrycodes: 'il' },
  'dimona': { countrycodes: 'il' },
  'negev': { q: 'Negev, Israel' },
  'galilee': { q: 'Galilee, Israel' },
  'golan': { q: 'Golan Heights' },
  'sderot': { countrycodes: 'il' },
  'nahariya': { countrycodes: 'il' },
  'kiryat shmona': { q: 'Kiryat Shmona, Israel' },
  'tiberias': { countrycodes: 'il' },
  'nazareth': { countrycodes: 'il' },
  'acre': { q: 'Acre, Israel' },
  'safed': { q: 'Safed, Israel' },
  'krayot': { q: 'Krayot, Israel' },
  'rishon lezion': { q: 'Rishon LeZion, Israel' },
  'petah tikva': { q: 'Petah Tikva, Israel' },
  'rehovot': { countrycodes: 'il' },
  'modiin': { q: "Modi'in, Israel" },
  'ramat gan': { q: 'Ramat Gan, Israel' },
  'bnei brak': { q: 'Bnei Brak, Israel' },
  'gaza': { q: 'Gaza City' },
  'gaza city': { q: 'Gaza City' },
  'gaza strip': { q: 'Gaza Strip' },
  'khan younis': { q: 'Khan Yunis, Gaza' },
  'khan yunis': { q: 'Khan Yunis, Gaza' },
  'rafah': { q: 'Rafah, Gaza' },
  'jabalia': { q: 'Jabalia, Gaza' },
  'nablus': { q: 'Nablus, West Bank' },
  'ramallah': { q: 'Ramallah, West Bank' },
  'hebron': { q: 'Hebron, West Bank' },
  'jenin': { q: 'Jenin, West Bank' },
  'tulkarm': { q: 'Tulkarm, West Bank' },
  'bethlehem': { q: 'Bethlehem, West Bank' },
  'west bank': { q: 'West Bank' },
  'jericho': { q: 'Jericho, West Bank' },
  'deir al-balah': { q: 'Deir al-Balah, Gaza' },
  'beirut': { countrycodes: 'lb' },
  'tyre': { q: 'Tyre, Lebanon' },
  'sidon': { q: 'Sidon, Lebanon' },
  'nabatieh': { q: 'Nabatieh, Lebanon' },
  'baalbek': { q: 'Baalbek, Lebanon' },
  'tripoli': { q: 'Tripoli, Lebanon' },
  'south lebanon': { q: 'South Lebanon' },
  'bekaa': { q: 'Bekaa Valley, Lebanon' },
  'dahiyeh': { q: 'Dahiyeh, Beirut' },
  'marjayoun': { q: 'Marjayoun, Lebanon' },
  'damascus': { countrycodes: 'sy' },
  'aleppo': { countrycodes: 'sy' },
  'homs': { countrycodes: 'sy' },
  'latakia': { countrycodes: 'sy' },
  'deir ez-zor': { q: 'Deir ez-Zor, Syria' },
  'idlib': { countrycodes: 'sy' },
  'daraa': { q: 'Daraa, Syria' },
  'raqqa': { countrycodes: 'sy' },
  'palmyra': { q: 'Palmyra, Syria' },
  'tehran': { countrycodes: 'ir' },
  'isfahan': { countrycodes: 'ir' },
  'natanz': { q: 'Natanz, Iran' },
  'shiraz': { countrycodes: 'ir' },
  'tabriz': { countrycodes: 'ir' },
  'mashhad': { countrycodes: 'ir' },
  'bandar abbas': { q: 'Bandar Abbas, Iran' },
  'bushehr': { q: 'Bushehr, Iran' },
  'qom': { countrycodes: 'ir' },
  'kashan': { q: 'Kashan, Iran' },
  'arak': { q: 'Arak, Iran' },
  'fordow': { q: 'Fordow, Iran' },
  'parchin': { q: 'Parchin, Iran' },
  'kharg island': { q: 'Kharg Island, Iran' },
  'chabahar': { q: 'Chabahar, Iran' },
  'abadan': { q: 'Abadan, Iran' },
  'ahvaz': { q: 'Ahvaz, Iran' },
  'kermanshah': { q: 'Kermanshah, Iran' },
  'yazd': { countrycodes: 'ir' },
  'baghdad': { countrycodes: 'iq' },
  'basra': { countrycodes: 'iq' },
  'erbil': { countrycodes: 'iq' },
  'mosul': { countrycodes: 'iq' },
  'kirkuk': { countrycodes: 'iq' },
  'fallujah': { q: 'Fallujah, Iraq' },
  'najaf': { countrycodes: 'iq' },
  'karbala': { countrycodes: 'iq' },
  'sanaa': { q: "Sana'a, Yemen" },
  'aden': { q: 'Aden, Yemen' },
  'hodeidah': { q: 'Hodeidah, Yemen' },
  'marib': { q: 'Marib, Yemen' },
  'taiz': { q: 'Taiz, Yemen' },
  'riyadh': { countrycodes: 'sa' },
  'jeddah': { countrycodes: 'sa' },
  'mecca': { countrycodes: 'sa' },
  'medina': { q: 'Medina, Saudi Arabia' },
  'dubai': { countrycodes: 'ae' },
  'abu dhabi': { q: 'Abu Dhabi, UAE' },
  'doha': { countrycodes: 'qa' },
  'manama': { countrycodes: 'bh' },
  'kuwait city': { q: 'Kuwait City, Kuwait' },
  'muscat': { countrycodes: 'om' },
  'amman': { countrycodes: 'jo' },
  'cairo': { countrycodes: 'eg' },
  'sinai': { q: 'Sinai Peninsula, Egypt' },
  'alexandria': { q: 'Alexandria, Egypt' },
  'ankara': { countrycodes: 'tr' },
  'istanbul': { countrycodes: 'tr' },
  'incirlik': { q: 'Incirlik, Turkey' },
  'strait of hormuz': { q: 'Strait of Hormuz' },
  'red sea': { q: 'Red Sea' },
  'persian gulf': { q: 'Persian Gulf' },
  'suez canal': { q: 'Suez Canal, Egypt' },
  'bab al-mandab': { q: 'Bab el-Mandeb Strait' },
  'mediterranean': { q: 'Mediterranean Sea' },
  'israel': { q: 'Israel' },
  'iran': { q: 'Iran' },
  'lebanon': { q: 'Lebanon' },
  'syria': { q: 'Syria' },
  'iraq': { q: 'Iraq' },
  'yemen': { q: 'Yemen' },
  'saudi arabia': { q: 'Saudi Arabia' },
  'bahrain': { q: 'Bahrain' },
  'qatar': { q: 'Qatar' },
  'jordan': { q: 'Jordan' },
  'egypt': { q: 'Egypt' },
  'turkey': { q: 'Turkey' },
  'uae': { q: 'United Arab Emirates' },
  'united arab emirates': { q: 'United Arab Emirates' },
  'kuwait': { q: 'Kuwait' },
  'oman': { q: 'Oman' },
  'pakistan': { q: 'Pakistan' },
};

// ── Nominatim geocoder ─────────────────────────────────────────────────────

async function geocodeNominatim(name: string, hint: LocationHint): Promise<{ lat: number; lng: number } | null> {
  const query = hint.q ?? name;
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '1',
  });
  if (hint.countrycodes) {
    params.set('countrycodes', hint.countrycodes);
  }

  const url = `https://nominatim.openstreetmap.org/search?${params}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!res.ok) {
      return null; // Rate limited or other error
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const names = Object.keys(FALLBACK_COORDS);
  const result: Record<string, { lat: number; lng: number }> = {};
  let fromNominatim = 0;
  let fromFallback = 0;
  let rateLimited = false;

  // Load existing results if any (to avoid re-fetching)
  let existing: Record<string, { lat: number; lng: number }> = {};
  if (existsSync(OUTPUT_PATH)) {
    try {
      existing = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
      console.log(`Loaded ${Object.keys(existing).length} existing coords from previous run.\n`);
    } catch {
      // ignore
    }
  }

  console.log(`Geocoding ${names.length} locations...`);
  console.log(`Strategy: Nominatim first, fallback coords if rate-limited.\n`);

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    process.stdout.write(`[${i + 1}/${names.length}] ${name}... `);

    // Check if we already have this from a previous run
    if (existing[name]) {
      result[name] = existing[name];
      console.log(`(cached) (${result[name].lat.toFixed(4)}, ${result[name].lng.toFixed(4)})`);
      fromNominatim++;
      continue;
    }

    // Try Nominatim if not rate-limited
    if (!rateLimited) {
      const hint = NOMINATIM_HINTS[name] ?? { q: name };
      const coords = await geocodeNominatim(name, hint);
      if (coords) {
        result[name] = coords;
        console.log(`(nominatim) (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
        fromNominatim++;
        if (i < names.length - 1) await sleep(RATE_LIMIT_MS);
        continue;
      }
      // If we get no result, assume rate-limited and switch to fallback mode
      rateLimited = true;
      console.log('rate-limited, switching to fallback mode...');
    }

    // Use fallback
    const fallback = FALLBACK_COORDS[name];
    if (fallback) {
      result[name] = fallback;
      console.log(`(fallback) (${fallback.lat.toFixed(4)}, ${fallback.lng.toFixed(4)})`);
      fromFallback++;
    } else {
      console.log('NO COORDS AVAILABLE');
    }
  }

  // Ensure output directory exists
  const outDir = join(__dirname, '../src/lib/geo');
  mkdirSync(outDir, { recursive: true });

  writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n');
  console.log(`\nDone! ${fromNominatim} from Nominatim/cache, ${fromFallback} from fallback.`);
  console.log(`Total: ${Object.keys(result).length} locations.`);
  console.log(`Output: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
