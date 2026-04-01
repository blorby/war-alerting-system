import { describe, it, expect } from 'vitest';
import { sha256, mapTitle, mapCategory, parseAsJerusalem } from './normalize';

describe('sha256', () => {
  it('produces a consistent 64-char hex hash', () => {
    const hash = sha256('hello');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256('hello')).toBe(hash);
  });

  it('produces different hashes for different inputs', () => {
    expect(sha256('hello')).not.toBe(sha256('world'));
  });
});

describe('mapTitle', () => {
  it('maps rocket/missile alert to alert/critical', () => {
    expect(mapTitle('ירי רקטות וטילים')).toEqual({ type: 'alert', severity: 'critical' });
  });

  it('maps hostile aircraft to alert/critical', () => {
    expect(mapTitle('חדירת כלי טיס עוין')).toEqual({ type: 'alert', severity: 'critical' });
  });

  it('maps terrorist infiltration to alert/critical', () => {
    expect(mapTitle('חדירת מחבלים')).toEqual({ type: 'alert', severity: 'critical' });
  });

  it('maps earthquake to seismic/moderate', () => {
    expect(mapTitle('רעידת אדמה')).toEqual({ type: 'seismic', severity: 'moderate' });
  });

  it('maps tsunami to alert/critical', () => {
    expect(mapTitle('צונאמי')).toEqual({ type: 'alert', severity: 'critical' });
  });

  it('maps hazardous materials to alert/moderate', () => {
    expect(mapTitle('חומרים מסוכנים')).toEqual({ type: 'alert', severity: 'moderate' });
  });

  it('maps event ended to alert/cleared', () => {
    expect(mapTitle('האירוע הסתיים')).toEqual({ type: 'alert', severity: 'cleared' });
  });

  it('defaults unknown titles to alert/moderate', () => {
    expect(mapTitle('unknown title')).toEqual({ type: 'alert', severity: 'moderate' });
  });
});

describe('mapCategory', () => {
  it('maps category 1 to alert/critical', () => {
    expect(mapCategory(1)).toEqual({ type: 'alert', severity: 'critical' });
  });

  it('maps category 2 to seismic/moderate', () => {
    expect(mapCategory(2)).toEqual({ type: 'seismic', severity: 'moderate' });
  });

  it('maps category 3 to alert/critical', () => {
    expect(mapCategory(3)).toEqual({ type: 'alert', severity: 'critical' });
  });

  it('maps category 13 to alert/cleared', () => {
    expect(mapCategory(13)).toEqual({ type: 'alert', severity: 'cleared' });
  });

  it('defaults unknown categories to alert/moderate', () => {
    expect(mapCategory(99)).toEqual({ type: 'alert', severity: 'moderate' });
  });
});

describe('parseAsJerusalem', () => {
  it('parses April date correctly (IDT = UTC+3)', () => {
    // April is in Israel Daylight Time (UTC+3)
    // 12:00 Jerusalem = 09:00 UTC
    const result = parseAsJerusalem('2025-04-15 12:00:00');
    expect(result.getUTCHours()).toBe(9);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
  });

  it('parses January date correctly (IST = UTC+2)', () => {
    // January is in Israel Standard Time (UTC+2)
    // 12:00 Jerusalem = 10:00 UTC
    const result = parseAsJerusalem('2025-01-15 12:00:00');
    expect(result.getUTCHours()).toBe(10);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
  });

  it('preserves minutes and seconds', () => {
    const result = parseAsJerusalem('2025-04-15 14:30:45');
    expect(result.getUTCHours()).toBe(11);
    expect(result.getUTCMinutes()).toBe(30);
    expect(result.getUTCSeconds()).toBe(45);
  });
});
