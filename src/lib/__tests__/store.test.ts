import { useAppStore, selectFilteredEvents, EventData } from '@/lib/store';

// Helper to create a mock EventData object
function makeEvent(overrides: Partial<EventData> = {}): EventData {
  return {
    id: overrides.id ?? 'evt-1',
    timestamp: overrides.timestamp ?? '2026-04-02T10:00:00Z',
    ingestedAt: overrides.ingestedAt ?? '2026-04-02T10:00:01Z',
    type: overrides.type ?? 'alert',
    severity: overrides.severity ?? 'critical',
    title: overrides.title ?? 'Test alert',
    description: overrides.description ?? null,
    locationName: overrides.locationName ?? null,
    lat: overrides.lat ?? 32.0,
    lng: overrides.lng ?? 35.0,
    source: overrides.source ?? 'oref',
    sourceId: overrides.sourceId ?? null,
    metadata: overrides.metadata ?? {},
    country: overrides.country ?? 'IL',
    isActive: overrides.isActive ?? true,
    dedupHash: overrides.dedupHash ?? null,
    corroborated: overrides.corroborated ?? false,
  };
}

// Helper to build a minimal AppState-like object for selectFilteredEvents
function makeState(overrides: Record<string, unknown> = {}) {
  const defaults = useAppStore.getState();
  return {
    ...defaults,
    ...overrides,
  };
}

// Reset the store before each test to avoid cross-test contamination
beforeEach(() => {
  useAppStore.setState({
    events: [],
    activeFront: 'all',
    activeType: 'all',
    playbackTime: null,
    liveWindow: null,
    isLive: false,
    isPlaying: false,
    playbackSpeed: 1,
    soundEnabled: false,
    announcementDismissed: false,
  });
});

// ─── Initial state ───────────────────────────────────────────────

describe('Store initial state', () => {
  it('has correct defaults', () => {
    const s = useAppStore.getState();
    expect(s.activeFront).toBe('all');
    expect(s.activeType).toBe('all');
    expect(s.isLive).toBe(false);
    expect(s.playbackTime).toBeNull();
    expect(s.isPlaying).toBe(false);
    expect(s.playbackSpeed).toBe(1);
    expect(s.soundEnabled).toBe(false);
    expect(s.liveWindow).toBeNull();
    expect(s.events).toEqual([]);
    expect(s.threat).toBeNull();
    expect(s.announcementDismissed).toBe(false);
  });
});

// ─── Simple actions ──────────────────────────────────────────────

describe('Store actions', () => {
  it('setFront updates activeFront', () => {
    useAppStore.getState().setFront('iran');
    expect(useAppStore.getState().activeFront).toBe('iran');
  });

  it('setType updates activeType', () => {
    useAppStore.getState().setType('strike');
    expect(useAppStore.getState().activeType).toBe('strike');
  });

  it('toggleSound flips soundEnabled', () => {
    expect(useAppStore.getState().soundEnabled).toBe(false);
    useAppStore.getState().toggleSound();
    expect(useAppStore.getState().soundEnabled).toBe(true);
    useAppStore.getState().toggleSound();
    expect(useAppStore.getState().soundEnabled).toBe(false);
  });

  it('goLive resets playbackTime and isPlaying', () => {
    useAppStore.setState({ playbackTime: new Date('2026-01-01'), isPlaying: true });
    useAppStore.getState().goLive();
    const s = useAppStore.getState();
    expect(s.playbackTime).toBeNull();
    expect(s.isPlaying).toBe(false);
  });

  it('stepBackward subtracts ms from playbackTime', () => {
    const base = new Date('2026-04-02T12:00:00Z');
    useAppStore.setState({ playbackTime: base });
    useAppStore.getState().stepBackward(60_000); // 1 minute
    const result = useAppStore.getState().playbackTime;
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(base.getTime() - 60_000);
  });

  it('stepForward adds ms to playbackTime', () => {
    const base = new Date('2026-01-01T12:00:00Z');
    useAppStore.setState({ playbackTime: base });
    useAppStore.getState().stepForward(60_000);
    const result = useAppStore.getState().playbackTime;
    expect(result).not.toBeNull();
    expect(result!.getTime()).toBe(base.getTime() + 60_000);
  });

  it('stepForward past current time goes live', () => {
    // Set playback to 1 second ago, step forward by 10 seconds => should go live
    const base = new Date(Date.now() - 1000);
    useAppStore.setState({ playbackTime: base, isPlaying: true });
    useAppStore.getState().stepForward(10_000);
    const s = useAppStore.getState();
    expect(s.playbackTime).toBeNull();
    expect(s.isPlaying).toBe(false);
  });

  it('dismissAnnouncement sets announcementDismissed to true', () => {
    useAppStore.getState().dismissAnnouncement();
    expect(useAppStore.getState().announcementDismissed).toBe(true);
  });
});

// ─── selectFilteredEvents ────────────────────────────────────────

describe('selectFilteredEvents', () => {
  it('returns all events when filters are "all"', () => {
    const events = [makeEvent({ id: '1' }), makeEvent({ id: '2' })];
    const state = makeState({ events, activeFront: 'all', activeType: 'all' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(2);
  });

  // --- Front filtering ---

  it('filters by front=iran (source match)', () => {
    const events = [
      makeEvent({ id: '1', source: 'iran-source', country: 'IR' }),
      makeEvent({ id: '2', source: 'oref', country: 'IL' }),
    ];
    const state = makeState({ events, activeFront: 'iran' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by front=iran (country=IR)', () => {
    const events = [
      makeEvent({ id: '1', source: 'generic', country: 'IR', title: 'Something' }),
      makeEvent({ id: '2', source: 'generic', country: 'IL', title: 'Something' }),
    ];
    const state = makeState({ events, activeFront: 'iran' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by front=iran (title match)', () => {
    const events = [
      makeEvent({ id: '1', source: 'generic', country: 'XX', title: 'Iran launches missile' }),
      makeEvent({ id: '2', source: 'generic', country: 'IL', title: 'Local news' }),
    ];
    const state = makeState({ events, activeFront: 'iran' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by front=iran (metadata category match)', () => {
    const events = [
      makeEvent({ id: '1', source: 'generic', country: null, title: 'A thing', metadata: { category: 'Iran stuff' } }),
      makeEvent({ id: '2', source: 'generic', country: null, title: 'Unrelated' }),
    ];
    const state = makeState({ events, activeFront: 'iran' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by front=gaza', () => {
    const events = [
      makeEvent({ id: '1', source: 'gaza-feed', title: 'Strike in Gaza' }),
      makeEvent({ id: '2', source: 'oref', title: 'Alert in Haifa' }),
    ];
    const state = makeState({ events, activeFront: 'gaza' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by front=lebanon', () => {
    const events = [
      makeEvent({ id: '1', source: 'lebanon-src', title: 'Something' }),
      makeEvent({ id: '2', source: 'other', title: 'Hezbollah fires rockets' }),
      makeEvent({ id: '3', source: 'other', title: 'Unrelated event' }),
    ];
    const state = makeState({ events, activeFront: 'lebanon' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(2);
  });

  it('filters by front=west_bank', () => {
    const events = [
      makeEvent({ id: '1', source: 'wafa-agency', title: 'Report' }),
      makeEvent({ id: '2', source: 'maan-news', title: 'Report' }),
      makeEvent({ id: '3', source: 'other', title: 'West Bank clash' }),
      makeEvent({ id: '4', source: 'other', title: 'Unrelated' }),
    ];
    const state = makeState({ events, activeFront: 'west_bank' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(3);
  });

  it('filters by front=internal', () => {
    const events = [
      makeEvent({ id: '1', source: 'oref-alerts', country: 'IL' }),
      makeEvent({ id: '2', source: 'telegram-hfc-bot', country: 'IL' }),
      makeEvent({ id: '3', source: 'oref-alerts', country: 'LB' }), // country not IL
      makeEvent({ id: '4', source: 'other', country: 'IL' }),
    ];
    const state = makeState({ events, activeFront: 'internal' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(2);
    expect(result.map(e => e.id).sort()).toEqual(['1', '2']);
  });

  // --- Type filtering ---

  it('filters by event type', () => {
    const events = [
      makeEvent({ id: '1', type: 'alert' }),
      makeEvent({ id: '2', type: 'strike' }),
      makeEvent({ id: '3', type: 'alert' }),
    ];
    const state = makeState({ events, activeType: 'alert' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(2);
    expect(result.every(e => e.type === 'alert')).toBe(true);
  });

  // --- Combined front + type filter ---

  it('filters by both front and type', () => {
    const events = [
      makeEvent({ id: '1', source: 'iran-x', type: 'alert' }),
      makeEvent({ id: '2', source: 'iran-x', type: 'strike' }),
      makeEvent({ id: '3', source: 'oref', type: 'alert' }),
    ];
    const state = makeState({ events, activeFront: 'iran', activeType: 'alert' });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  // --- Playback time cutoff ---

  it('filters by playback time cutoff', () => {
    const events = [
      makeEvent({ id: '1', timestamp: '2026-04-02T10:00:00Z' }),
      makeEvent({ id: '2', timestamp: '2026-04-02T11:00:00Z' }),
      makeEvent({ id: '3', timestamp: '2026-04-02T12:00:00Z' }),
    ];
    const cutoff = new Date('2026-04-02T11:30:00Z');
    const state = makeState({ events, playbackTime: cutoff });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(2);
    expect(result.map(e => e.id).sort()).toEqual(['1', '2']);
  });

  // --- Live window filter ---

  it('filters by liveWindow=15m', () => {
    const now = Date.now();
    const events = [
      makeEvent({ id: '1', timestamp: new Date(now - 5 * 60 * 1000).toISOString() }),   // 5m ago
      makeEvent({ id: '2', timestamp: new Date(now - 10 * 60 * 1000).toISOString() }),  // 10m ago
      makeEvent({ id: '3', timestamp: new Date(now - 30 * 60 * 1000).toISOString() }),  // 30m ago
    ];
    const state = makeState({ events, liveWindow: '15m', playbackTime: null });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(2);
  });

  it('filters by liveWindow=1h', () => {
    const now = Date.now();
    const events = [
      makeEvent({ id: '1', timestamp: new Date(now - 30 * 60 * 1000).toISOString() }),  // 30m ago
      makeEvent({ id: '2', timestamp: new Date(now - 90 * 60 * 1000).toISOString() }),  // 90m ago
    ];
    const state = makeState({ events, liveWindow: '1h', playbackTime: null });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('filters by liveWindow=3h', () => {
    const now = Date.now();
    const events = [
      makeEvent({ id: '1', timestamp: new Date(now - 60 * 60 * 1000).toISOString() }),     // 1h ago
      makeEvent({ id: '2', timestamp: new Date(now - 4 * 60 * 60 * 1000).toISOString() }), // 4h ago
    ];
    const state = makeState({ events, liveWindow: '3h', playbackTime: null });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('liveWindow is ignored when playbackTime is set', () => {
    const now = Date.now();
    const events = [
      makeEvent({ id: '1', timestamp: new Date(now - 5 * 60 * 1000).toISOString() }),
      makeEvent({ id: '2', timestamp: new Date(now - 30 * 60 * 1000).toISOString() }),
    ];
    // playbackTime is far in the future, liveWindow=15m should be ignored
    const state = makeState({
      events,
      liveWindow: '15m',
      playbackTime: new Date(now + 60 * 60 * 1000),
    });
    const result = selectFilteredEvents(state);
    expect(result).toHaveLength(2);
  });

  // --- Memoization ---

  it('returns same reference for same inputs (memoization)', () => {
    const events = [makeEvent({ id: '1' })];
    const state = makeState({ events, activeFront: 'all', activeType: 'all' });
    const r1 = selectFilteredEvents(state);
    const r2 = selectFilteredEvents(state);
    expect(r1).toBe(r2);
  });

  it('returns different reference when inputs change', () => {
    const events = [makeEvent({ id: '1' })];
    const state1 = makeState({ events, activeFront: 'all', activeType: 'all' });
    const r1 = selectFilteredEvents(state1);
    const state2 = makeState({ events, activeFront: 'iran', activeType: 'all' });
    const r2 = selectFilteredEvents(state2);
    expect(r1).not.toBe(r2);
  });
});
