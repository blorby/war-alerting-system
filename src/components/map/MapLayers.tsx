"use client";

import { useState } from "react";

const LAYERS = [
  { id: "alerts", label: "Alerts", color: "#ef4444" },
  { id: "flights", label: "Flights", color: "#3b82f6" },
  { id: "ships", label: "Ships", color: "#22c55e" },
  { id: "strikes", label: "Strikes", color: "#f97316" },
  { id: "seismic", label: "Seismic", color: "#8b5cf6" },
  { id: "thermal", label: "Thermal", color: "#ec4899" },
  { id: "heatmap", label: "Heatmap", color: "#06b6d4" },
  { id: "news", label: "News", color: "#3b82f6" },
  { id: "missiles", label: "Missiles", color: "#6366f1" },
  { id: "social", label: "Social", color: "#a855f7" },
] as const;

export default function MapLayers() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(LAYERS.map((l) => [l.id, true]))
  );

  const toggle = (id: string) => {
    setEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="rounded bg-surface-elevated/90 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur hover:bg-surface-elevated"
      >
        Layers
      </button>

      {open && (
        <div className="mt-1 rounded bg-surface-elevated/95 p-2 backdrop-blur">
          {LAYERS.map((layer) => (
            <label
              key={layer.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-border/30"
            >
              <input
                type="checkbox"
                checked={enabled[layer.id]}
                onChange={() => toggle(layer.id)}
                className="h-3 w-3 rounded"
                style={{ accentColor: layer.color }}
              />
              <span className="text-xs">{layer.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
