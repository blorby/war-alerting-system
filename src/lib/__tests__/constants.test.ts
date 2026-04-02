import { EVENT_TYPES, SEVERITIES, LAYER_NAMES, FOCUS_AREAS, COUNTRIES } from '@/lib/constants';

// Regex for a valid hex color (3, 4, 6, or 8 hex digits after #)
const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

describe('EVENT_TYPES', () => {
  it('has unique values', () => {
    const values = EVENT_TYPES.map(t => t.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('all entries have non-empty labels', () => {
    for (const t of EVENT_TYPES) {
      expect(t.label.length).toBeGreaterThan(0);
    }
  });

  it('all entries have valid hex colors', () => {
    for (const t of EVENT_TYPES) {
      expect(t.color).toMatch(HEX_COLOR_RE);
    }
  });
});

describe('SEVERITIES', () => {
  it('has unique values', () => {
    const values = SEVERITIES.map(s => s.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('all entries have valid hex colors', () => {
    for (const s of SEVERITIES) {
      expect(s.color).toMatch(HEX_COLOR_RE);
      expect(s.bgColor).toMatch(HEX_COLOR_RE);
    }
  });

  it('all entries have non-empty labels', () => {
    for (const s of SEVERITIES) {
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});

describe('LAYER_NAMES', () => {
  it('has unique ids', () => {
    const ids = LAYER_NAMES.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all entries have non-empty labels', () => {
    for (const l of LAYER_NAMES) {
      expect(l.label.length).toBeGreaterThan(0);
    }
  });

  it('all entries have valid hex colors', () => {
    for (const l of LAYER_NAMES) {
      expect(l.color).toMatch(HEX_COLOR_RE);
    }
  });
});

describe('FOCUS_AREAS', () => {
  it('all areas have valid bounds (min < max for both axes)', () => {
    for (const [key, area] of Object.entries(FOCUS_AREAS)) {
      const [[lng1, lat1], [lng2, lat2]] = area.bounds;
      expect(lng1).toBeLessThan(lng2);
      expect(lat1).toBeLessThan(lat2);
    }
  });

  it('all areas have non-empty labels', () => {
    for (const area of Object.values(FOCUS_AREAS)) {
      expect(area.label.length).toBeGreaterThan(0);
    }
  });

  it('bounds contain exactly 2 coordinate pairs', () => {
    for (const area of Object.values(FOCUS_AREAS)) {
      expect(area.bounds).toHaveLength(2);
      expect(area.bounds[0]).toHaveLength(2);
      expect(area.bounds[1]).toHaveLength(2);
    }
  });
});

describe('COUNTRIES', () => {
  it('has unique codes', () => {
    const codes = COUNTRIES.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('all entries have non-empty names', () => {
    for (const c of COUNTRIES) {
      expect(c.name.length).toBeGreaterThan(0);
    }
  });

  it('all codes are 2-letter uppercase strings (ISO 3166-1 alpha-2 format)', () => {
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('all entries have a flag emoji', () => {
    for (const c of COUNTRIES) {
      expect(c.flag.length).toBeGreaterThan(0);
    }
  });
});
