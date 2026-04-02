"use client";

import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n/useT";

const typeColors: Record<string, string> = {
  news: "bg-info",
  alert: "bg-critical",
  thermal: "bg-moderate",
  social: "bg-purple-500",
};

export default function NewsTicker() {
  const t = useT();
  const items = useAppStore((s) => s.tickerItems);

  if (items.length === 0) {
    return (
      <div className="flex h-7 shrink-0 items-center border-t border-border bg-surface px-4">
        <span className="text-xs text-muted">
          {t("ticker.waiting")}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-7 shrink-0 items-center overflow-hidden border-t border-border bg-surface">
      <div className="animate-marquee flex whitespace-nowrap">
        {items.map((item) => (
          <span key={item.id} className="mx-6 flex items-center gap-2 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${typeColors[item.type] ?? "bg-muted"}`}
            />
            <span className="text-foreground">{item.text}</span>
            <span className="text-muted">
              {formatTimeAgo(new Date(item.timestamp), t)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date, t: (key: string, params?: Record<string, string | number>) => string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t("time.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("time.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  return t("time.daysAgo", { n: days });
}
