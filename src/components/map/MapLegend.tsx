"use client";

import { useState } from "react";

const ALERT_STATUSES = [
  { label: "Active", sublabel: "Active fight / incoming", color: "#ef4444" },
  { label: "Warning", sublabel: "Warning / pre-impact", color: "#f97316" },
  { label: "Cleared", sublabel: "Ended / de-escalation", color: "#22c55e" },
  { label: "Info", sublabel: "Informational", color: "#3b82f6" },
];

const MAP_SYMBOLS = [
  { label: "Airstrike", sublabel: "Bomber / aerial attack" },
  { label: "Explosion", sublabel: "Missile / rocket impact" },
  { label: "Ground Op", sublabel: "Infantry / ground forces" },
  { label: "Drone Strike", sublabel: "UAV attack" },
  { label: "Heat Source", sublabel: "NASA FIRMS thermal anomaly" },
  { label: "Aircraft", sublabel: "ADS-B commercial / military" },
];

export default function MapLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="rounded bg-surface-elevated/90 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur hover:bg-surface-elevated"
      >
        Legend
      </button>

      {open && (
        <div className="mt-1 w-52 rounded bg-surface-elevated/95 p-3 backdrop-blur">
          <div className="mb-2 text-xs font-bold text-muted">ALERT STATUS</div>
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
            MAP SYMBOLS
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
