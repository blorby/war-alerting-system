"use client";

const TIME_RANGES = ["24h", "48h", "7d", "30d", "All"] as const;

interface TimelineBarProps {
  isLive?: boolean;
  currentTime?: Date;
}

export default function TimelineBar({
  isLive = true,
  currentTime,
}: TimelineBarProps) {
  const now = currentTime ?? new Date();

  return (
    <div className="flex h-20 shrink-0 flex-col border-t border-border bg-surface">
      <div className="flex items-center gap-3 px-4 py-1">
        {/* Playback controls */}
        <div className="flex items-center gap-1">
          <button className="rounded p-1 text-muted hover:text-foreground" aria-label="Skip back">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
          <button className="rounded p-1 text-muted hover:text-foreground" aria-label="Pause">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
            </svg>
          </button>
          <button className="rounded p-1 text-muted hover:text-foreground" aria-label="Skip forward">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5m6-15l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>

        {/* LIVE button */}
        <button
          className={`rounded px-3 py-0.5 text-xs font-bold ${
            isLive
              ? "bg-green-500/20 text-green-500"
              : "bg-surface-elevated text-muted hover:text-foreground"
          }`}
        >
          LIVE
        </button>

        {/* Speed */}
        <span className="text-xs text-muted">1x</span>

        {/* Current time */}
        <span className="text-xs text-muted">
          {now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}{" "}
          {now.toLocaleTimeString("en-US", { hour12: false })}
        </span>

        {/* Time range buttons */}
        <div className="ml-auto flex items-center gap-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              className={`rounded px-2 py-0.5 text-xs ${
                range === "24h"
                  ? "bg-info/20 text-info"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Event density histogram placeholder */}
      <div className="flex flex-1 items-end gap-px px-4 pb-1">
        {Array.from({ length: 48 }, (_, i) => {
          const h = Math.random() * 100;
          return (
            <div
              key={i}
              className="flex-1 rounded-t bg-critical/30"
              style={{ height: `${Math.max(h, 2)}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
