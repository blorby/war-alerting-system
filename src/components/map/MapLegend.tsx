"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/useT";

export default function MapLegend() {
  const t = useT();
  const [open, setOpen] = useState(false);

  const ALERT_STATUSES = [
    { label: t("legend.active"), sublabel: t("legend.activeSub"), color: "#ef4444" },
    { label: t("legend.warning"), sublabel: t("legend.warningSub"), color: "#f97316" },
    { label: t("legend.cleared"), sublabel: t("legend.clearedSub"), color: "#22c55e" },
    { label: t("legend.info"), sublabel: t("legend.infoSub"), color: "#3b82f6" },
  ];

  const MAP_SYMBOLS = [
    { label: t("legend.airstrike"), sublabel: t("legend.airstrikeSub") },
    { label: t("legend.explosion"), sublabel: t("legend.explosionSub") },
    { label: t("legend.groundOp"), sublabel: t("legend.groundOpSub") },
    { label: t("legend.droneStrike"), sublabel: t("legend.droneStrikeSub") },
    { label: t("legend.heatSource"), sublabel: t("legend.heatSourceSub") },
    { label: t("legend.aircraft"), sublabel: t("legend.aircraftSub") },
  ];

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="rounded bg-surface-elevated/90 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur hover:bg-surface-elevated"
      >
        {t("legend.button")}
      </button>

      {open && (
        <div className="mt-1 w-52 rounded bg-surface-elevated/95 p-3 backdrop-blur">
          <div className="mb-2 text-xs font-bold text-muted">{t("legend.alertStatus")}</div>
          {ALERT_STATUSES.map((s) => (
            <div key={s.label} className="mb-1 flex items-start gap-2">
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <div>
                <div className="text-xs font-medium">{s.label}</div>
                <div className="text-xs text-muted">{s.sublabel}</div>
              </div>
            </div>
          ))}

          <div className="mb-2 mt-3 text-xs font-bold text-muted">
            {t("legend.mapSymbols")}
          </div>
          {MAP_SYMBOLS.map((s) => (
            <div key={s.label} className="mb-1">
              <div className="text-xs font-medium">{s.label}</div>
              <div className="text-xs text-muted">{s.sublabel}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
