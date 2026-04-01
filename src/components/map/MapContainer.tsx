"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/geo/regions";
import { useAppStore } from "@/lib/store";
import { EVENT_TYPES } from "@/lib/constants";
import MapFocus from "./MapFocus";
import MapLayers from "./MapLayers";
import MapLegend from "./MapLegend";

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const EVENTS_SOURCE = "events-source";
const EVENTS_CIRCLES_LAYER = "events-circles";
const EVENTS_GLOW_LAYER = "events-glow";

/** Build a MapLibre match expression that maps event type strings to colors. */
function buildTypeColorMatch(): maplibregl.ExpressionSpecification {
  const stops: (string | maplibregl.ExpressionSpecification)[] = [];
  for (const et of EVENT_TYPES) {
    stops.push(et.value, et.color);
  }
  return ["match", ["get", "type"], ...stops, "#888888"] as unknown as maplibregl.ExpressionSpecification;
}

/** Human-readable relative time string. */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const events = useAppStore((s) => s.events);

  const geoEvents = useMemo(
    () => events.filter((e) => e.lat != null && e.lng != null),
    [events],
  );

  // --- Map initialization ---
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    map.on("load", () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- Event pins (GeoJSON source + layers) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: geoEvents.map((e) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [e.lng!, e.lat!],
        },
        properties: {
          id: e.id,
          type: e.type,
          severity: e.severity,
          title: e.title,
          locationName: e.locationName ?? "",
          source: e.source,
          timestamp: e.timestamp,
        },
      })),
    };

    const source = map.getSource(EVENTS_SOURCE) as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(geojson);
    } else {
      map.addSource(EVENTS_SOURCE, { type: "geojson", data: geojson });

      // Glow layer for critical events (rendered below the main circles)
      map.addLayer({
        id: EVENTS_GLOW_LAYER,
        type: "circle",
        source: EVENTS_SOURCE,
        filter: ["==", ["get", "severity"], "critical"],
        paint: {
          "circle-radius": 18,
          "circle-color": buildTypeColorMatch(),
          "circle-opacity": 0.25,
          "circle-blur": 1,
        },
      });

      // Main circle layer
      map.addLayer({
        id: EVENTS_CIRCLES_LAYER,
        type: "circle",
        source: EVENTS_SOURCE,
        paint: {
          "circle-radius": [
            "match",
            ["get", "severity"],
            "critical", 10,
            "moderate", 7,
            "info", 5,
            "cleared", 4,
            6,
          ] as unknown as maplibregl.ExpressionSpecification,
          "circle-color": buildTypeColorMatch(),
          "circle-opacity": [
            "match",
            ["get", "severity"],
            "critical", 1,
            "cleared", 0.6,
            0.85,
          ] as unknown as maplibregl.ExpressionSpecification,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": 0.8,
        },
      });

      // Popup on click
      map.on("click", EVENTS_CIRCLES_LAYER, (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const p = feature.properties as Record<string, string>;
        const time = p.timestamp ? timeAgo(p.timestamp) : "";

        new maplibregl.Popup({ closeButton: false, className: "event-popup" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${p.title}</strong>` +
            (p.locationName ? `<br/>${p.locationName}` : "") +
            `<br/><small>${p.source}${time ? ` &middot; ${time}` : ""}</small>`,
          )
          .addTo(map);
      });

      // Cursor changes on hover
      map.on("mouseenter", EVENTS_CIRCLES_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", EVENTS_CIRCLES_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });
    }
  }, [geoEvents, mapReady]);

  const handleFocusChange = useCallback(
    (bounds: [[number, number], [number, number]]) => {
      mapRef.current?.fitBounds(bounds, { padding: 50, duration: 1000 });
    },
    [],
  );

  return (
    <div className="relative flex-1">
      <div ref={containerRef} className="h-full w-full" />

      {/* Map overlay controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <MapLayers />
        <MapFocus onFocusChange={handleFocusChange} />
        <MapLegend />
      </div>

      {/* Coordinates display */}
      {mapReady && (
        <div className="absolute bottom-2 left-2 text-xs text-muted">
          {DEFAULT_CENTER[1].toFixed(2)}, {DEFAULT_CENTER[0].toFixed(2)} z
          {DEFAULT_ZOOM}
        </div>
      )}
    </div>
  );
}
