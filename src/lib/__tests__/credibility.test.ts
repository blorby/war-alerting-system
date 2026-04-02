import {
  getSourceCategory,
  computeEventCredibility,
  computeNewsCredibility,
  getCredibilityLevel,
  getCredibilityColor,
} from '@/lib/credibility';

// ─── getSourceCategory ──────────────────────────────────────────

describe('getSourceCategory', () => {
  it('returns "official" for oref-current', () => {
    expect(getSourceCategory('oref-current')).toBe('official');
  });

  it('returns "news" for toi', () => {
    expect(getSourceCategory('toi')).toBe('news');
  });

  it('returns "social" for telegram-idf', () => {
    expect(getSourceCategory('telegram-idf')).toBe('social');
  });

  it('returns "unknown" for unrecognized source', () => {
    expect(getSourceCategory('some-random-source')).toBe('unknown');
  });
});

// ─── computeEventCredibility ────────────────────────────────────

describe('computeEventCredibility', () => {
  it('official source uncorroborated = 90', () => {
    expect(computeEventCredibility('oref-current', false)).toBe(90);
  });

  it('official source corroborated = 100 (capped)', () => {
    expect(computeEventCredibility('oref-current', true)).toBe(100);
  });

  it('news source uncorroborated = 60', () => {
    expect(computeEventCredibility('toi', false)).toBe(60);
  });

  it('news source corroborated = 80', () => {
    expect(computeEventCredibility('toi', true)).toBe(80);
  });

  it('social source uncorroborated = 30', () => {
    expect(computeEventCredibility('telegram-idf', false)).toBe(30);
  });

  it('social source corroborated = 50', () => {
    expect(computeEventCredibility('telegram-idf', true)).toBe(50);
  });

  it('unknown source uncorroborated = 20', () => {
    expect(computeEventCredibility('some-random-source', false)).toBe(20);
  });

  it('unknown source corroborated = 40', () => {
    expect(computeEventCredibility('some-random-source', true)).toBe(40);
  });
});

// ─── computeNewsCredibility ─────────────────────────────────────

describe('computeNewsCredibility', () => {
  it('returns tier score for known source (official)', () => {
    expect(computeNewsCredibility('oref-current')).toBe(90);
  });

  it('returns tier score for known source (social)', () => {
    expect(computeNewsCredibility('telegram-idf')).toBe(30);
  });

  it('returns tier score for known source (news)', () => {
    expect(computeNewsCredibility('toi')).toBe(60);
  });

  it('falls back to news tier for unrecognized source', () => {
    // News items from unknown sources default to news-tier credibility (60)
    // since they're already in the news feed
    expect(computeNewsCredibility('some-random-source')).toBe(60);
  });
});

// ─── getCredibilityLevel ────────────────────────────────────────

describe('getCredibilityLevel', () => {
  it('returns "high" for score >= 70', () => {
    expect(getCredibilityLevel(70)).toBe('high');
    expect(getCredibilityLevel(100)).toBe('high');
    expect(getCredibilityLevel(85)).toBe('high');
  });

  it('returns "medium" for score 45-69', () => {
    expect(getCredibilityLevel(45)).toBe('medium');
    expect(getCredibilityLevel(69)).toBe('medium');
    expect(getCredibilityLevel(55)).toBe('medium');
  });

  it('returns "low" for score < 45', () => {
    expect(getCredibilityLevel(44)).toBe('low');
    expect(getCredibilityLevel(0)).toBe('low');
    expect(getCredibilityLevel(30)).toBe('low');
  });
});

// ─── getCredibilityColor ────────────────────────────────────────

describe('getCredibilityColor', () => {
  it('returns green colors for high credibility', () => {
    const color = getCredibilityColor(90);
    expect(color).toEqual({ text: 'text-green-400', bg: 'bg-green-500/20' });
  });

  it('returns yellow colors for medium credibility', () => {
    const color = getCredibilityColor(55);
    expect(color).toEqual({ text: 'text-yellow-400', bg: 'bg-yellow-500/20' });
  });

  it('returns orange colors for low credibility', () => {
    const color = getCredibilityColor(20);
    expect(color).toEqual({ text: 'text-orange-400', bg: 'bg-orange-500/20' });
  });
});
