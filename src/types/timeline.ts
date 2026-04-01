export type PlaybackSpeed = 1 | 2 | 5 | 10;

export type TimeRangePreset = '24h' | '48h' | '7d' | '30d' | 'all';

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface PlaybackState {
  isLive: boolean;
  isPlaying: boolean;
  currentTime: Date;
  speed: PlaybackSpeed;
  range: TimeRange;
}
