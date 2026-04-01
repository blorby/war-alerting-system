"use client";

import { useState } from "react";
import { FOCUS_AREAS, type FocusArea } from "@/lib/geo/regions";

interface MapFocusProps {
  onFocusChange: (bounds: [[number, number], [number, number]]) => void;
}

export default function MapFocus({ onFocusChange }: MapFocusProps) {
  const [active, setActive] = useState<FocusArea>("region");
  const [open, setOpen] = useState(false);

  const handleClick = (area: FocusArea) => {
    setActive(area);
    const { bounds } = FOCUS_AREAS[area];
    onFocusChange(bounds as [[number, number], [number, number]]);
  };

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="rounded bg-surface-elevated/90 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur hover:bg-surface-elevated"
      >
        FOCUS
      </button>

      {open && (
        <div className="mt-1 rounded bg-surface-elevated/95 p-2 backdrop-blur">
          {(Object.keys(FOCUS_AREAS) as FocusArea[]).map((area) => (
            <button
              key={area}
              onClick={() => handleClick(area)}
              className={`block w-full rounded px-2 py-0.5 text-left text-xs ${
                active === area
                  ? "bg-info/20 text-info"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {FOCUS_AREAS[area].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
