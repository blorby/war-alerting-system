"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/geo/regions";
import { useAppStore } from "@/lib/store";
import { EVENT_TYPES } from "@/lib/constants";
import districtsData from '@/lib/geo/districts.json';
import MapFocus from "./MapFocus";
import MapLayers from "./MapLayers";
import MapLegend from "./MapLegend";

const COUNTRY_LABELS: { name: string; lng: number; lat: number }[] = [
  { name: 'ISRAEL', lng: 35.0, lat: 31.5 },
  { name: 'IRAN', lng: 53.0, lat: 32.5 },
  { name: 'IRAQ', lng: 44.0, lat: 33.0 },
  { name: 'SYRIA', lng: 38.5, lat: 35.0 },
  { name: 'SAUDI ARABIA', lng: 45.0, lat: 24.0 },
  { name: 'PERSIAN GULF', lng: 51.0, lat: 26.5 },
  { name: 'RED SEA', lng: 38.0, lat: 21.0 },
  { name: 'MEDITERRANEAN', lng: 32.0, lat: 34.5 },
  { name: 'LEBANON', lng: 35.8, lat: 33.9 },
  { name: 'EGYPT', lng: 30.0, lat: 26.0 },
  { name: 'TURKEY', lng: 35.0, lat: 39.0 },
];

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const EVENTS_SOURCE = "events-source";
const EVENTS_CIRCLES_LAYER = "events-circles";
const EVENTS_GLOW_LAYER = "events-glow";

const POLYGONS_SOURCE = 'alert-polygons-source';
const POLYGONS_FILL_LAYER = 'alert-polygons-fill';
const POLYGONS_LINE_LAYER = 'alert-polygons-line';

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
  const [viewState, setViewState] = useState({
    lat: DEFAULT_CENTER[1],
    lng: DEFAULT_CENTER[0],
    zoom: DEFAULT_ZOOM,
  });

  const events = useAppStore((s) => s.events);

  const geoEvents = useMemo(
    () => events.filter((e) => e.lat != null && e.lng != null),
    [events],
  );

  const areaAlertStatus = useMemo(() => {
    const districts = districtsData as Record<string, { areaid: number }>;
    const statusMap = new Map<number, string>();
    const severityRank: Record<string, number> = { critical: 3, moderate: 2, info: 1, cleared: 0 };

    for (const e of events) {
      if (e.type === 'alert' && e.locationName) {
        const district = districts[e.locationName];
        if (!district?.areaid) continue;

        const current = statusMap.get(district.areaid);
        const currentRank = current ? (severityRank[current] ?? 0) : -1;
        const newRank = severityRank[e.severity] ?? 0;

        if (e.isActive && newRank > currentRank) {
          statusMap.set(district.areaid, e.severity);
        } else if (!e.isActive && !statusMap.has(district.areaid)) {
          statusMap.set(district.areaid, 'cleared');
        }
      }
    }
    return statusMap;
  }, [events]);

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
      COUNTRY_LABELS.forEach(({ name, lng, lat }) => {
        const el = document.createElement('div');
        el.className = 'text-[10px] font-bold text-white/40 tracking-wider pointer-events-none select-none';
        el.style.whiteSpace = 'nowrap';
        el.textContent = name;
        new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
      });
      setMapReady(true);
    });

    map.on("moveend", () => {
      const center = map.getCenter();
      setViewState({
        lat: center.lat,
        lng: center.lng,
        zoom: Math.round(map.getZoom() * 10) / 10,
      });
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

  // --- Alert zone polygons ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const loadPolygons = async () => {
      let polygonData: GeoJSON.FeatureCollection;
      try {
        const res = await fetch('/district-polygons.geojson');
        if (!res.ok) return;
        polygonData = await res.json();
      } catch {
        return;
      }

      // Tag each feature with current alert severity
      for (const feature of polygonData.features) {
        const areaid = (feature.properties as Record<string, unknown>)?.areaid as number;
        const severity = areaAlertStatus.get(areaid) ?? null;
        (feature.properties as Record<string, unknown>).severity = severity;
      }

      const source = map.getSource(POLYGONS_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(polygonData);
      } else {
        map.addSource(POLYGONS_SOURCE, { type: 'geojson', data: polygonData });

        // Insert polygon layers BELOW the glow layer so event markers stay on top
        const beforeLayer = map.getLayer(EVENTS_GLOW_LAYER) ? EVENTS_GLOW_LAYER : undefined;

        map.addLayer(
          {
            id: POLYGONS_FILL_LAYER,
            type: 'fill',
            source: POLYGONS_SOURCE,
            paint: {
              'fill-color': [
                'match',
                ['get', 'severity'],
                'critical', '#ef4444',
                'moderate', '#f97316',
                'info', '#3b82f6',
                'cleared', '#22c55e',
                'transparent',
              ] as unknown as maplibregl.ExpressionSpecification,
              'fill-opacity': [
                'match',
                ['get', 'severity'],
                'critical', 0.3,
                'moderate', 0.25,
                'info', 0.15,
                'cleared', 0.1,
                0,
              ] as unknown as maplibregl.ExpressionSpecification,
            },
          },
          beforeLayer,
        );

        map.addLayer(
          {
            id: POLYGONS_LINE_LAYER,
            type: 'line',
            source: POLYGONS_SOURCE,
            paint: {
              'line-color': [
                'match',
                ['get', 'severity'],
                'critical', '#ef4444',
                'moderate', '#f97316',
                'info', '#3b82f6',
                'cleared', '#22c55e',
                'transparent',
              ] as unknown as maplibregl.ExpressionSpecification,
              'line-width': [
                'case',
                ['!=', ['get', 'severity'], null],
                1.5,
                0,
              ] as unknown as maplibregl.ExpressionSpecification,
              'line-opacity': 0.6,
            },
          },
          beforeLayer,
        );
      }
    };

    loadPolygons();
  }, [areaAlertStatus, mapReady]);

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
          {viewState.lat.toFixed(2)}, {viewState.lng.toFixed(2)} z{viewState.zoom}
        </div>
      )}
    </div>
  );
}
