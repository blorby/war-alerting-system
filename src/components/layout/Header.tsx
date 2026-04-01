"use client";

interface HeaderProps {
  threatScore?: number;
  threatLevel?: string;
  isLive?: boolean;
  lastUpdate?: Date;
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
  threatScore,
  isLive = true,
  lastUpdate,
}: HeaderProps) {
  const score = threatScore ?? 0;
  const label = getThreatLabel(score);
  const color = getThreatColor(score);

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

        {threatScore !== undefined && (
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
          <span className="text-xs text-muted">
            upd {formatTimeAgo(lastUpdate)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button className="rounded px-2 py-1 text-xs text-muted hover:bg-surface-elevated hover:text-foreground">
          EN
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
