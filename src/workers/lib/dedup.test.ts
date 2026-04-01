import { describe, it, expect } from 'vitest';
import { orefCurrentHash, orefHistoryHash } from './dedup';

describe('orefCurrentHash', () => {
  it('produces a 64-char hex hash', () => {
    const hash = orefCurrentHash('ירי רקטות וטילים', 'תל אביב', new Date('2025-04-15T12:00:00Z'));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same hash within the same minute', () => {
    const t1 = new Date('2025-04-15T12:00:10Z');
    const t2 = new Date('2025-04-15T12:00:20Z');
    expect(orefCurrentHash('alert', 'city', t1)).toBe(orefCurrentHash('alert', 'city', t2));
  });

  it('produces different hashes across different minutes', () => {
    const t1 = new Date('2025-04-15T12:00:00Z');
    const t2 = new Date('2025-04-15T12:01:01Z');
    expect(orefCurrentHash('alert', 'city', t1)).not.toBe(orefCurrentHash('alert', 'city', t2));
  });

  it('produces different hashes for different cities', () => {
    const t = new Date('2025-04-15T12:00:00Z');
    expect(orefCurrentHash('alert', 'תל אביב', t)).not.toBe(orefCurrentHash('alert', 'חיפה', t));
  });
});

describe('orefHistoryHash', () => {
  it('produces consistent hash for same inputs', () => {
    const hash1 = orefHistoryHash('2025-04-15', 'data123');
    const hash2 = orefHistoryHash('2025-04-15', 'data123');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hash for different alertDate', () => {
    expect(orefHistoryHash('2025-04-15', 'data')).not.toBe(orefHistoryHash('2025-04-16', 'data'));
  });

  it('produces different hash for different data', () => {
    expect(orefHistoryHash('2025-04-15', 'data1')).not.toBe(orefHistoryHash('2025-04-15', 'data2'));
  });
});
