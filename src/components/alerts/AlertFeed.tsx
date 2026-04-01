"use client";

interface Alert {
  id: string;
  severity: "critical" | "moderate" | "info" | "cleared";
  title: string;
  locationName: string | null;
  source: string;
  timestamp: Date;
}

interface AlertFeedProps {
  alerts?: Alert[];
  count?: number;
}

const severityConfig = {
  critical: { label: "CRITICAL", color: "text-critical", bg: "bg-critical/10", dot: "bg-critical" },
  moderate: { label: "MODERATE", color: "text-moderate", bg: "bg-moderate/10", dot: "bg-moderate" },
  info: { label: "INFO", color: "text-info", bg: "bg-info/10", dot: "bg-info" },
  cleared: { label: "CLEARED", color: "text-cleared", bg: "bg-cleared/10", dot: "bg-cleared" },
};

export default function AlertFeed({ alerts = [], count = 0 }: AlertFeedProps) {
  return (
    <section className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <svg className="h-4 w-4 text-critical" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
        </svg>
        <span className="text-xs font-bold tracking-wide">ALERT FEED</span>
        {count > 0 && (
          <span className="rounded-full bg-critical/20 px-2 py-0.5 text-xs font-bold text-critical">
            {count}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted">
            No active alerts
          </div>
        ) : (
          alerts.map((alert) => {
            const config = severityConfig[alert.severity];
            return (
              <div
                key={alert.id}
                className={`border-b border-border/50 px-3 py-2 ${config.bg}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                  <span className={`text-xs font-bold ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-muted">
                    {formatTimeAgo(alert.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium">{alert.title}</p>
                {alert.locationName && (
                  <p className="mt-0.5 text-xs text-muted">
                    @ {alert.locationName} &middot; {alert.source}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
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
