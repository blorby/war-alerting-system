import { sha256 } from './normalize';

export function scraperDedupHash(source: string, url: string): string {
  return sha256(`scraper:${source}:${url}`);
}
