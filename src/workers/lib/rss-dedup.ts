import { sha256 } from './normalize';

export function rssDedupHash(source: string, guid: string): string {
  return sha256(`rss:${source}:${guid}`);
}
