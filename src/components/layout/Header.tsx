"use client";

import { useAppStore } from "@/lib/store";

interface HeaderProps {
  isLive?: boolean;
  lastUpdate?: Date | null;
}

function getThreatColor(score: number): string {
  if (score >= 8) return "text-critical";
  if (score >= 6) return "text-moderate";
  if (score >= 4) return "text-warning";
  return "text-cleared";
}

function getThreatLabel(score: number): string {
  if (score >= 8) return "CRITICAL";
  if (score >= 6) return "HIGH";
  if (score >= 4) return "ELEVATED";
  if (score >= 2) return "GUARDED";
  return "LOW";
}

export default function Header({
  isLive = true,
  lastUpdate,
}: HeaderProps) {
  const threat = useAppStore((s) => s.threat);
  const score = threat?.overallScore ?? 0;
  const label = getThreatLabel(score);
  const color = getThreatColor(score);

  const getConnectionColor = () => {
    if (!lastUpdate) return 'bg-red-500';
    const age = Date.now() - new Date(lastUpdate).getTime();
    if (age < 30_000) return 'bg-green-500';
    if (age < 120_000) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-bold tracking-wide">
          <span className="text-foreground">WAR</span>
          <span className="text-muted">ALERTING</span>
          <span className="text-foreground">SYSTEM</span>
        </h1>

        {isLive && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-500">LIVE</span>
          </div>
        )}

        {threat !== null && (
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${color}`}>
              THREAT: {label}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-bold ${color} bg-surface-elevated`}
            >
              ({score.toFixed(1)})
            </span>
          </div>
        )}

        {lastUpdate && (
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${getConnectionColor()}`} />
            <span className="text-xs text-muted">
              upd {formatTimeAgo(lastUpdate)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled
          title="Coming soon"
          className="cursor-not-allowed rounded px-2 py-1 text-xs text-muted opacity-50"
        >
          EN
        </button>
        <button className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Suggest Source
        </button>
        <button className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </button>
      </div>
    </header>
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
