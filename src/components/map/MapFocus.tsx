"use client";

import { useState } from "react";
import { FOCUS_AREAS, type FocusArea } from "@/lib/geo/regions";

interface MapFocusProps {
  onFocusChange: (bounds: [[number, number], [number, number]]) => void;
}

export default function MapFocus({ onFocusChange }: MapFocusProps) {
  const [active, setActive] = useState<FocusArea>("region");

  const handleClick = (area: FocusArea) => {
    setActive(area);
    const { bounds } = FOCUS_AREAS[area];
    onFocusChange(bounds as [[number, number], [number, number]]);
  };

  return (
    <div className="rounded bg-surface-elevated/90 p-2 backdrop-blur">
      <div className="mb-1 text-xs font-bold text-muted">FOCUS</div>
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
  );
}
