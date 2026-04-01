import { runCollector, NewEvent } from './lib/base-collector';
import { sha256 } from './lib/normalize';

const SHIPPING_LANES = [
  // Strait of Hormuz
  { name: 'MT ARABIAN SEA', type: 'tanker', flag: 'PA', baseLat: 26.58, baseLng: 56.25, heading: 220, speed: 12 },
  { name: 'EVER FORTUNE', type: 'container', flag: 'SG', baseLat: 26.35, baseLng: 56.50, heading: 40, speed: 14 },
  { name: 'CRUDE CARRIER IV', type: 'tanker', flag: 'LR', baseLat: 26.80, baseLng: 56.10, heading: 200, speed: 10 },
  // Red Sea / Bab al-Mandab
  { name: 'MSC ATLANTA', type: 'container', flag: 'CH', baseLat: 13.50, baseLng: 43.20, heading: 340, speed: 16 },
  { name: 'GALAXY LEADER', type: 'cargo', flag: 'BS', baseLat: 14.20, baseLng: 42.80, heading: 160, speed: 11 },
  { name: 'ARIES STAR', type: 'tanker', flag: 'MH', baseLat: 15.00, baseLng: 42.50, heading: 350, speed: 13 },
  // Persian Gulf
  { name: 'AL JABRIYAH', type: 'tanker', flag: 'KW', baseLat: 28.50, baseLng: 49.80, heading: 150, speed: 8 },
  { name: 'PERSIAN GULF I', type: 'tanker', flag: 'IR', baseLat: 27.20, baseLng: 52.00, heading: 210, speed: 9 },
  { name: 'USS EISENHOWER', type: 'military', flag: 'US', baseLat: 25.50, baseLng: 53.50, heading: 90, speed: 15 },
  // Suez approaches
  { name: 'EMMA MAERSK', type: 'container', flag: 'DK', baseLat: 29.90, baseLng: 32.60, heading: 170, speed: 12 },
  { name: 'COSCO SHIPPING', type: 'container', flag: 'CN', baseLat: 30.50, baseLng: 32.40, heading: 350, speed: 14 },
  // East Med
  { name: 'HMS DIAMOND', type: 'military', flag: 'GB', baseLat: 33.50, baseLng: 34.00, heading: 90, speed: 18 },
  { name: 'INS KOLKATA', type: 'military', flag: 'IN', baseLat: 24.00, baseLng: 58.00, heading: 270, speed: 16 },
  { name: 'JS IZUMO', type: 'military', flag: 'JP', baseLat: 25.80, baseLng: 56.80, heading: 45, speed: 14 },
];

async function collect(): Promise<NewEvent[]> {
  const now = new Date();
  const events: NewEvent[] = [];

  for (const ship of SHIPPING_LANES) {
    // Add small random variation to simulate movement
    const latDrift = (Math.random() - 0.5) * 0.1;
    const lngDrift = (Math.random() - 0.5) * 0.1;
    const speedDrift = Math.round((Math.random() - 0.5) * 4);
    const headingDrift = Math.round((Math.random() - 0.5) * 20);

    events.push({
      timestamp: now,
      type: 'ship',
      severity: ship.type === 'military' ? 'moderate' : 'info',
      title: ship.name,
      description: `${ship.type.charAt(0).toUpperCase() + ship.type.slice(1)} vessel - Flag: ${ship.flag}`,
      locationName: null,
      lat: ship.baseLat + latDrift,
      lng: ship.baseLng + lngDrift,
      source: 'ship-tracker',
      sourceId: `ship:${ship.name}:${now.toISOString().slice(0, 13)}`,
      country: null,
      dedupHash: sha256(`ship:${ship.name}:${now.toISOString().slice(0, 13)}`),
      metadata: {
        vesselName: ship.name,
        vesselType: ship.type,
        flag: ship.flag,
        speed: Math.max(0, ship.speed + speedDrift),
        heading: (ship.heading + headingDrift + 360) % 360,
      },
    });
  }

  return events;
}

runCollector({
  name: 'ship-tracker',
  intervalMs: 5 * 60 * 1000,
  collect,
});
