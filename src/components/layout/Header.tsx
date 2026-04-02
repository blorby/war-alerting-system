"use client";

import { useAppStore } from "@/lib/store";
import { useT, useLocale, useSetLocale } from "@/lib/i18n/useT";

interface HeaderProps {
  isLive?: boolean;
  lastUpdate?: Date | null;
  onMenuToggle?: () => void;
}

function getThreatColor(score: number): string {
  if (score >= 8) return "text-critical";
  if (score >= 6) return "text-moderate";
  if (score >= 4) return "text-warning";
  return "text-cleared";
}

function getThreatLabelKey(score: number): string {
  if (score >= 8) return "threatLevel.critical";
  if (score >= 6) return "threatLevel.high";
  if (score >= 4) return "threatLevel.elevated";
  if (score >= 2) return "threatLevel.guarded";
  return "threatLevel.low";
}

export default function Header({
  isLive = true,
  lastUpdate,
  onMenuToggle,
}: HeaderProps) {
  const t = useT();
  const locale = useLocale();
  const setLocale = useSetLocale();
  const threat = useAppStore((s) => s.threat);
  const score = threat?.overallScore ?? 0;
  const label = t(getThreatLabelKey(score));
  const color = getThreatColor(score);

  const getConnectionColor = () => {
    if (!lastUpdate) return 'bg-red-500';
    const age = Date.now() - new Date(lastUpdate).getTime();
    if (age < 30_000) return 'bg-green-500';
    if (age < 120_000) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-surface px-2 md:px-4">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        {/* Mobile hamburger */}
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="md:hidden shrink-0 p-1 text-muted hover:text-foreground"
            aria-label={t("header.menu")}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        )}

        <h1 className="text-sm font-bold tracking-wide shrink-0">
          <span className="text-foreground">WAR</span>
          <span className="text-muted hidden sm:inline">ALERTING</span>
          <span className="text-foreground hidden sm:inline">SYSTEM</span>
          {/* Short name on mobile */}
          <span className="text-muted sm:hidden">AS</span>
        </h1>

        {isLive && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-500">{t("header.live")}</span>
          </div>
        )}

        {threat !== null && (
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <span className={`text-xs font-bold ${color}`}>
              <span className="hidden sm:inline">{t("header.threat")} </span>{label}
            </span>
            <span
              className={`rounded px-1 md:px-1.5 py-0.5 text-xs font-bold ${color} bg-surface-elevated`}
            >
              ({score.toFixed(1)})
            </span>
          </div>
        )}

        {lastUpdate && (
          <div className="hidden sm:flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${getConnectionColor()}`} />
            <span className="text-xs text-muted">
              {t("header.updatedAgo", { time: formatTimeAgo(lastUpdate, t) })}
            </span>
          </div>
        )}
      </div>

      <div className="hidden sm:flex items-center gap-2">
        <button
          onClick={() => setLocale(locale === "he" ? "en" : "he")}
          className="rounded px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
        >
          {locale === "he" ? "EN" : "עב"}
        </button>
        <button className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          {t("header.suggestSource")}
        </button>
        <button className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          {t("header.edit")}
        </button>
      </div>
    </header>
  );
}

function formatTimeAgo(date: Date, t: (key: string, params?: Record<string, string | number>) => string): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return t("time.lessThanMinute");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t("time.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  return t("time.hoursAgo", { n: hours });
}
