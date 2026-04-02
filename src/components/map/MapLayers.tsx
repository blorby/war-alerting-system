"use client";

import { useState, useCallback } from "react";
import type maplibregl from "maplibre-gl";

// Map UI toggle IDs to the actual MapLibre layer IDs they control
const LAYER_GROUPS: Record<string, string[]> = {
  alerts: ['alert-polygons-fill', 'alert-polygons-line', 'alert-polygons-icons'],
  flights: [], // flight events filtered by type in events source
  ships: [],
  strikes: [],
  seismic: [],
  thermal: [],
  heatmap: ['events-heatmap'],
  news: [],
  missiles: ['trajectories-line', 'hit-zones-fill', 'hit-zones-ring'],
  social: [],
};

// Event types that map to type-filtered layers (controlled via filter on events-circles/icons)
const EVENT_TYPE_MAP: Record<string, string[]> = {
  alerts: ['alert'],
  flights: ['flight'],
  ships: ['ship'],
  strikes: ['strike'],
  seismic: ['seismic'],
  thermal: ['thermal'],
  news: ['news'],
  social: ['social'],
};

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

interface MapLayersProps {
  mapRef: React.RefObject<maplibregl.Map | null>;
}

export default function MapLayers({ mapRef }: MapLayersProps) {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(LAYERS.map((l) => [l.id, true]))
  );

  const toggle = useCallback((id: string) => {
    setEnabled((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      const map = mapRef.current;
      if (!map) return next;

      const visible = next[id];

      // Toggle dedicated map layers
      const layerIds = LAYER_GROUPS[id] || [];
      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
        }
      }

      // For event-type layers, rebuild the combined type filter on events-circles and events-icons
      // Collect all currently visible event types
      const visibleTypes: string[] = [];
      for (const layer of LAYERS) {
        const isVisible = layer.id === id ? visible : next[layer.id];
        if (isVisible && EVENT_TYPE_MAP[layer.id]) {
          visibleTypes.push(...EVENT_TYPE_MAP[layer.id]);
        }
      }

      // Build filter: show events whose type is in the visible set
      const typeFilter: maplibregl.ExpressionSpecification = visibleTypes.length > 0
        ? ['in', ['get', 'type'], ['literal', visibleTypes]]
        : ['==', ['get', 'type'], '__none__'] as unknown as maplibregl.ExpressionSpecification;

      for (const evLayer of ['events-circles', 'events-glow', 'events-icons']) {
        if (map.getLayer(evLayer)) {
          map.setFilter(evLayer, typeFilter as maplibregl.FilterSpecification);
        }
      }

      return next;
    });
  }, [mapRef]);

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
