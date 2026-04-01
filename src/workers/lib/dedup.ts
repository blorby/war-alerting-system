import { sha256 } from './normalize';

/**
 * Generates a dedup hash for an Oref current alert.
 * Rounds fetchTime to the nearest minute before hashing.
 */
export function orefCurrentHash(title: string, city: string, fetchTime: Date): string {
  const roundedTime = new Date(Math.round(fetchTime.getTime() / 60000) * 60000);
  return sha256(`oref:${title}:${city}:${roundedTime.toISOString()}`);
}

/**
 * Generates a dedup hash for an Oref history alert.
 */
export function orefHistoryHash(alertDate: string, data: string): string {
  return sha256(`oref-hist:${alertDate}:${data}`);
}
