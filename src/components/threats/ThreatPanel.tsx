"use client";

import { useAppStore } from "@/lib/store";
import { COUNTRIES } from "@/lib/constants";
import ThreatHistoryChart from "./ThreatHistoryChart";

const trendArrows = {
  escalating: "↗",
  "de-escalating": "↘",
  stable: "→",
};

const trendColors = {
  escalating: "text-critical",
  "de-escalating": "text-cleared",
  stable: "text-muted",
};

function scoreColor(score: number): string {
  if (score >= 8) return "bg-critical";
  if (score >= 6) return "bg-moderate";
  if (score >= 4) return "bg-warning";
  if (score >= 2) return "bg-cleared";
  return "bg-muted";
}

export default function ThreatPanel() {
  const threat = useAppStore((s) => s.threat);

  const overallScore = threat?.overallScore;
  const overallTrend = threat?.overallTrend ?? "stable";
  const countries = (threat?.countries ?? []).map((c) => ({
    ...c,
    flag: COUNTRIES.find((cc) => cc.code === c.countryCode)?.flag ?? "",
  }));

  return (
    <section className="flex flex-col border-t border-border">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-moderate" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold tracking-wide">THREAT LEVEL</span>
        </div>
        {overallTrend && (
          <span className={`text-xs font-bold ${trendColors[overallTrend]}`}>
            {trendArrows[overallTrend]} {overallTrend.toUpperCase()}
          </span>
        )}
      </div>

      {threat === null ? (
        <div className="px-3 py-4 text-center text-xs text-muted">
          Awaiting assessment...
        </div>
      ) : (
        <>
          {overallScore !== undefined && (
            <div className="flex items-center justify-center gap-1 py-2">
              <span className="text-3xl font-bold">{overallScore.toFixed(1)}</span>
              <span className="text-sm text-muted">/ 10</span>
            </div>
          )}

          <ThreatHistoryChart />

          <div className="space-y-0.5 px-3 pb-2">
            {countries.map((c) => (
              <div key={c.countryCode} className="flex items-center gap-2 py-0.5">
                <span className="w-5 text-center text-sm">{c.flag}</span>
                <span className="w-6 text-xs text-muted">{c.countryCode}</span>
                <div className="flex-1">
                  <div className="h-1.5 w-full rounded-full bg-border">
                    <div
                      className={`h-1.5 rounded-full ${scoreColor(c.score)} transition-all`}
                      style={{ width: `${(c.score / 10) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-7 text-right text-xs font-medium">
                  {c.score > 0 ? c.score.toFixed(1) : "-"}
                </span>
                <span className={`w-3 text-xs ${trendColors[c.trend]}`}>
                  {trendArrows[c.trend]}
                </span>
              </div>
            ))}
          </div>

        </>
      )}
    </section>
  );
}
