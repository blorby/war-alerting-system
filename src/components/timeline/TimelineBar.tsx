"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import KeyboardShortcuts from "@/components/layout/KeyboardShortcuts";

const TIME_RANGES = ["24h", "48h", "7d", "30d", "All"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

const BUCKET_COUNT = 48;

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

interface TimelineBarProps {
  isLive?: boolean;
}

export default function TimelineBar({
  isLive = true,
}: TimelineBarProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const [selectedRange, setSelectedRange] = useState<TimeRange>("24h");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const events = useAppStore((state) => state.events);

  const buckets = useMemo(() => {
    if (events.length === 0) {
      return Array.from({ length: BUCKET_COUNT }, () => 2);
    }

    const rangeMs = getRangeMs(selectedRange);

    let rangeStart: number;
    let rangeEnd: number;

    if (rangeMs !== null) {
      rangeEnd = now.getTime();
      rangeStart = rangeEnd - rangeMs;

      // Check if events are too clustered — auto-zoom if all in one bucket
      const eventTimestamps = events
        .map((e) => new Date(e.timestamp).getTime())
        .filter((ts) => ts >= rangeStart && ts <= rangeEnd);

      if (eventTimestamps.length > 1) {
        const minTs = Math.min(...eventTimestamps);
        const maxTs = Math.max(...eventTimestamps);
        const span = maxTs - minTs;
        const bucketWidth = (rangeEnd - rangeStart) / BUCKET_COUNT;

        // If all events fit in fewer than 3 buckets, zoom to event span with padding
        if (span < bucketWidth * 3 && span > 0) {
          const padding = span * 0.5 || 60_000; // at least 1 minute padding
          rangeStart = minTs - padding;
          rangeEnd = maxTs + padding;
        }
      }
    } else {
      // "All" range: span from oldest to newest event
      const timestamps = events.map((e) => new Date(e.timestamp).getTime());
      const oldest = Math.min(...timestamps);
      const newest = Math.max(...timestamps);
      // Add a small buffer so the newest event doesn't sit exactly on the edge
      rangeStart = oldest;
      rangeEnd = newest === oldest ? newest + 1 : newest;
    }

    const bucketWidth = (rangeEnd - rangeStart) / BUCKET_COUNT;
    const counts = new Array<number>(BUCKET_COUNT).fill(0);

    for (const event of events) {
      const ts = new Date(event.timestamp).getTime();
      if (ts < rangeStart || ts > rangeEnd) continue;
      const idx = Math.min(
        Math.floor((ts - rangeStart) / bucketWidth),
        BUCKET_COUNT - 1,
      );
      counts[idx]++;
    }

    const maxCount = Math.max(...counts);
    if (maxCount === 0) {
      return Array.from({ length: BUCKET_COUNT }, () => 2);
    }

    return counts.map((c) => Math.max((c / maxCount) * 100, 2));
  }, [events, selectedRange, now]);

  return (
    <div className="flex h-20 shrink-0 flex-col border-t border-border bg-surface">
      <div className="flex items-center gap-3 px-4 py-1">
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <button className="rounded p-1 text-muted hover:text-foreground transition-colors" aria-label="Skip back" onClick={() => {}}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
          <button className="rounded p-1 text-muted hover:text-foreground transition-colors" aria-label="Pause" onClick={() => {}}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
            </svg>
          </button>
          <button className="rounded p-1 text-muted hover:text-foreground transition-colors" aria-label="Skip forward" onClick={() => {}}>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* LIVE button */}
        <button
          className={`rounded px-3 py-0.5 text-xs font-bold transition-colors ${
            isLive
              ? "bg-green-500/20 text-green-400"
              : "bg-surface-elevated text-muted hover:text-foreground"
          }`}
          onClick={() => {}}
        >
          LIVE
        </button>

        {/* Speed */}
        <div className="flex items-center gap-0.5">
          <button className="text-muted hover:text-foreground transition-colors" aria-label="Speed down" onClick={() => {}}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <span className="text-xs text-muted min-w-[1.5rem] text-center">1x</span>
          <button className="text-muted hover:text-foreground transition-colors" aria-label="Speed up" onClick={() => {}}>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* Current time */}
        <span className="text-xs text-muted" suppressHydrationWarning>
          {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
          {now.toLocaleTimeString("en-US", { hour12: false })}
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

      {/* Event density histogram */}
      <div className="flex flex-1 items-end gap-px px-4 pb-1">
        {buckets.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-critical/30"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
