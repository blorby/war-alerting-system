"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import KeyboardShortcuts from "@/components/layout/KeyboardShortcuts";

const TIME_RANGES = ["24h", "48h", "7d", "30d", "All"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

const LIVE_WINDOWS = ["15m", "1h", "3h"] as const;
const LIVE_WINDOW_LABELS: Record<string, string> = {
  "15m": "15 min",
  "1h": "1 hour",
  "3h": "3 hours",
};

const BUCKET_COUNT = 48;
const SPEEDS = [1, 2, 5, 10];

function getRangeMs(range: TimeRange): number | null {
  switch (range) {
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "48h":
      return 48 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    case "All":
      return null;
  }
}

const trendArrows: Record<string, string> = {
  escalating: "\u2197",
  "de-escalating": "\u2198",
  stable: "\u2192",
};

const trendColors: Record<string, string> = {
  escalating: "text-critical",
  "de-escalating": "text-cleared",
  stable: "text-muted",
};

interface TimelineBarProps {
  isLive?: boolean;
}

export default function TimelineBar({
  isLive: _isLiveProp = true,
}: TimelineBarProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const [selectedRange, setSelectedRange] = useState<TimeRange>("24h");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const events = useAppStore((state) => state.events);

  const playbackTime = useAppStore((s) => s.playbackTime);
  const playbackSpeed = useAppStore((s) => s.playbackSpeed);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setPlaybackTime = useAppStore((s) => s.setPlaybackTime);
  const setPlaybackSpeed = useAppStore((s) => s.setPlaybackSpeed);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const goLive = useAppStore((s) => s.goLive);
  const stepForward = useAppStore((s) => s.stepForward);
  const stepBackward = useAppStore((s) => s.stepBackward);

  const liveWindow = useAppStore((s) => s.liveWindow);
  const setLiveWindow = useAppStore((s) => s.setLiveWindow);

  const threat = useAppStore((s) => s.threat);
  const threatHistory = useAppStore((s) => s.threatHistory);
  const lastUpdate = useAppStore((s) => s.lastUpdate);

  // Playback animation: advance time when playing
  useEffect(() => {
    if (!isPlaying || playbackTime === null) return;
    const interval = setInterval(() => {
      stepForward(1000 * playbackSpeed);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, playbackTime, playbackSpeed, stepForward]);

  const displayTime = playbackTime ?? now;

  const { buckets, rangeStart, rangeEnd } = useMemo(() => {
    if (events.length === 0) {
      return {
        buckets: Array.from({ length: BUCKET_COUNT }, () => 2),
        rangeStart: now.getTime() - 24 * 60 * 60 * 1000,
        rangeEnd: now.getTime(),
      };
    }

    const rangeMs = getRangeMs(selectedRange);

    let rStart: number;
    let rEnd: number;

    if (rangeMs !== null) {
      rEnd = now.getTime();
      rStart = rEnd - rangeMs;

      // Check if events are too clustered — auto-zoom if all in one bucket
      const eventTimestamps = events
        .map((e) => new Date(e.timestamp).getTime())
        .filter((ts) => ts >= rStart && ts <= rEnd);

      if (eventTimestamps.length > 1) {
        const minTs = Math.min(...eventTimestamps);
        const maxTs = Math.max(...eventTimestamps);
        const span = maxTs - minTs;
        const bucketWidth = (rEnd - rStart) / BUCKET_COUNT;

        // If all events fit in fewer than 3 buckets, zoom to event span with padding
        if (span < bucketWidth * 3 && span > 0) {
          const padding = span * 0.5 || 60_000; // at least 1 minute padding
          rStart = minTs - padding;
          rEnd = maxTs + padding;
        }
      }
    } else {
      // "All" range: span from oldest to newest event
      const timestamps = events.map((e) => new Date(e.timestamp).getTime());
      const oldest = Math.min(...timestamps);
      const newest = Math.max(...timestamps);
      // Add a small buffer so the newest event doesn't sit exactly on the edge
      rStart = oldest;
      rEnd = newest === oldest ? newest + 1 : newest;
    }

    const bucketWidth = (rEnd - rStart) / BUCKET_COUNT;
    const counts = new Array<number>(BUCKET_COUNT).fill(0);

    for (const event of events) {
      const ts = new Date(event.timestamp).getTime();
      if (ts < rStart || ts > rEnd) continue;
      const idx = Math.min(
        Math.floor((ts - rStart) / bucketWidth),
        BUCKET_COUNT - 1,
      );
      counts[idx]++;
    }

    const maxCount = Math.max(...counts);
    if (maxCount === 0) {
      return {
        buckets: Array.from({ length: BUCKET_COUNT }, () => 2),
        rangeStart: rStart,
        rangeEnd: rEnd,
      };
    }

    return {
      buckets: counts.map((c) => Math.max((c / maxCount) * 100, 2)),
      rangeStart: rStart,
      rangeEnd: rEnd,
    };
  }, [events, selectedRange, now]);

  // Playback cursor position on the histogram
  const cursorPercent = useMemo(() => {
    if (!playbackTime) return null;
    const total = rangeEnd - rangeStart;
    if (total <= 0) return null;
    const pos = ((playbackTime.getTime() - rangeStart) / total) * 100;
    return Math.max(0, Math.min(100, pos));
  }, [playbackTime, rangeStart, rangeEnd]);

  // Threat sparkline SVG path
  const sparklinePath = useMemo(() => {
    if (threatHistory.length < 2) return null;
    const points = threatHistory.slice(-30);
    const width = 120;
    const height = 20;
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - (p.score / 10) * height;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [threatHistory]);

  const overallTrend = threat?.overallTrend ?? "stable";

  return (
    <div className="flex shrink-0 flex-col border-t border-border bg-surface">
      <div className="flex items-center gap-3 px-4 py-1">
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <button
            className="rounded p-1 text-muted hover:text-foreground transition-colors"
            aria-label="Skip back"
            onClick={() => {
              const stepMs = getRangeMs(selectedRange) ? (getRangeMs(selectedRange)! / BUCKET_COUNT) : 3600000;
              stepBackward(stepMs);
            }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            className="rounded p-1 text-muted hover:text-foreground transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() => {
              if (playbackTime === null) {
                setPlaybackTime(new Date());
              }
              setIsPlaying(!isPlaying);
            }}
          >
            {isPlaying ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
            )}
          </button>
          <button
            className="rounded p-1 text-muted hover:text-foreground transition-colors"
            aria-label="Skip forward"
            onClick={() => {
              const stepMs = getRangeMs(selectedRange) ? (getRangeMs(selectedRange)! / BUCKET_COUNT) : 3600000;
              stepForward(stepMs);
            }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* LIVE button */}
        <button
          className={`rounded px-3 py-0.5 text-xs font-bold transition-colors ${
            playbackTime === null
              ? "bg-green-500/20 text-green-400"
              : "bg-surface-elevated text-muted hover:text-foreground"
          }`}
          onClick={() => {
            goLive();
            setLiveWindow(null);
          }}
        >
          {"\u00AB"} LIVE
        </button>

        {/* Live window filter — only in live mode */}
        {playbackTime === null && (
          <div className="flex items-center gap-0.5 border-l border-border pl-2">
            {LIVE_WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setLiveWindow(liveWindow === w ? null : w)}
                className={`rounded px-2 py-0.5 text-xs transition-colors ${
                  liveWindow === w
                    ? "bg-green-500/20 text-green-400 font-medium"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {LIVE_WINDOW_LABELS[w]}
              </button>
            ))}
          </div>
        )}

        {/* Speed */}
        <div className="flex items-center gap-0.5">
          <button
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Speed down"
            onClick={() => {
              const idx = SPEEDS.indexOf(playbackSpeed);
              if (idx > 0) setPlaybackSpeed(SPEEDS[idx - 1]);
            }}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <span className="text-xs text-muted min-w-[1.5rem] text-center">{playbackSpeed}x</span>
          <button
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Speed up"
            onClick={() => {
              const idx = SPEEDS.indexOf(playbackSpeed);
              if (idx < SPEEDS.length - 1) setPlaybackSpeed(SPEEDS[idx + 1]);
            }}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Current time */}
        <span className={`text-xs ${playbackTime ? "text-warning font-medium" : "text-muted"}`} suppressHydrationWarning>
          {playbackTime ? "\u23F1 " : ""}
          {displayTime.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
          {displayTime.toLocaleTimeString("en-US", { hour12: false })}
        </span>

        {/* Time range buttons */}
        <div className="ml-auto flex items-center gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setSelectedRange(range)}
              className={`rounded px-2 py-0.5 text-xs ${
                range === selectedRange
                  ? "bg-info/20 text-info"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
          <button
            onClick={() => setShowShortcuts(true)}
            className="px-1.5 py-0.5 text-[10px] text-muted hover:text-foreground border border-border rounded transition-colors"
            title="Keyboard shortcuts"
          >
            ? Keys
          </button>
        </div>
      </div>
      <KeyboardShortcuts open={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Event density histogram with playback cursor */}
      <div className="flex flex-1 items-end gap-px px-4 pb-1">
        <div className="relative flex flex-1 items-end gap-px" style={{ minHeight: 24 }}>
          {buckets.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t bg-critical/30"
              style={{ height: `${h}%` }}
            />
          ))}
          {cursorPercent !== null && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-warning/80 pointer-events-none z-10"
              style={{ left: `${cursorPercent}%` }}
            >
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-warning" />
            </div>
          )}
        </div>
      </div>

      {/* Threat Level row */}
      <div className="flex items-center gap-4 border-t border-border/50 px-4 py-1">
        <span className="text-[10px] font-bold tracking-wider text-muted uppercase leading-tight">
          THREAT<br />LEVEL
        </span>

        {/* Sparkline */}
        {sparklinePath && (
          <svg width="120" height="20" className="shrink-0" viewBox="0 0 120 20">
            <path d={sparklinePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
          </svg>
        )}

        {threat && (
          <>
            <span className={`text-xs font-bold ${trendColors[overallTrend]}`}>
              {trendArrows[overallTrend]} {overallTrend.toUpperCase()}
            </span>
            {lastUpdate && (
              <span className="text-[10px] text-muted">
                {formatTimeAgo(lastUpdate)}
              </span>
            )}
          </>
        )}
        {!threat && (
          <span className="text-[10px] text-muted">Awaiting assessment...</span>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "less than a minute ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
