import { createHash } from 'crypto';

/** Returns the SHA-256 hex digest of the input string. */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

const TITLE_MAP: Record<string, { type: string; severity: string }> = {
  'ירי רקטות וטילים': { type: 'alert', severity: 'critical' },
  'חדירת כלי טיס עוין': { type: 'alert', severity: 'critical' },
  'חדירת מחבלים': { type: 'alert', severity: 'critical' },
  'רעידת אדמה': { type: 'seismic', severity: 'moderate' },
  'צונאמי': { type: 'alert', severity: 'critical' },
  'חומרים מסוכנים': { type: 'alert', severity: 'moderate' },
  'האירוע הסתיים': { type: 'alert', severity: 'cleared' },
};

/** Maps a Hebrew Oref alert title to an event type and severity. */
export function mapTitle(title: string): { type: string; severity: string } {
  return TITLE_MAP[title] ?? { type: 'alert', severity: 'moderate' };
}

const CATEGORY_MAP: Record<number, { type: string; severity: string }> = {
  1: { type: 'alert', severity: 'critical' },
  2: { type: 'seismic', severity: 'moderate' },
  3: { type: 'alert', severity: 'critical' },
  13: { type: 'alert', severity: 'cleared' },
};

/** Maps an Oref category number to an event type and severity. */
export function mapCategory(category: number): { type: string; severity: string } {
  return CATEGORY_MAP[category] ?? { type: 'alert', severity: 'moderate' };
}

/**
 * Parses a date string in "YYYY-MM-DD HH:MM:SS" format as Asia/Jerusalem
 * local time and returns a UTC Date object. Handles DST via the Intl API.
 */
export function parseAsJerusalem(dateStr: string): Date {
  // Parse the components from the date string
  const [datePart, timePart] = dateStr.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  // Create a provisional UTC date to probe the Jerusalem offset at that time.
  // We start with a guess, then refine.
  const provisionalUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Use Intl.DateTimeFormat to find the UTC offset at this approximate time
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(provisionalUtc);

  function getPart(type: Intl.DateTimeFormatPartTypes): number {
    const part = parts.find((p) => p.type === type);
    if (!part) {
      throw new Error(`Could not find date part: ${type}`);
    }
    return Number(part.value);
  }

  // What Jerusalem shows for our provisional UTC time
  const jYear = getPart('year');
  const jMonth = getPart('month');
  const jDay = getPart('day');
  const jHour = getPart('hour') === 24 ? 0 : getPart('hour');
  const jMinute = getPart('minute');
  const jSecond = getPart('second');

  // Compute the offset: Jerusalem_local = UTC + offset
  // So offset = Jerusalem_local - UTC (in ms)
  const jerusalemMs = Date.UTC(jYear, jMonth - 1, jDay, jHour, jMinute, jSecond);
  const offsetMs = jerusalemMs - provisionalUtc.getTime();

  // The actual UTC time is: local_jerusalem_time - offset
  const actualUtcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMs;

  return new Date(actualUtcMs);
}
