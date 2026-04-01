"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/geo/regions";
import { useAppStore, selectFilteredEvents } from "@/lib/store";
import { EVENT_TYPES } from "@/lib/constants";
import districtsData from '@/lib/geo/districts.json';
import polygonsData from '@/lib/geo/district-polygons.json';
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

const CITY_LABELS: { name: string; lng: number; lat: number; minZoom?: number }[] = [
  // Major cities always visible (zoom >= 4)
  { name: 'Baghdad', lng: 44.37, lat: 33.31 },
  { name: 'Riyadh', lng: 46.72, lat: 24.63 },
  { name: 'Tehran', lng: 51.39, lat: 35.69 },
  { name: 'Cairo', lng: 31.24, lat: 30.04 },
  { name: 'Ankara', lng: 32.86, lat: 39.93 },
  { name: 'Amman', lng: 35.93, lat: 31.95 },
  // Visible at zoom >= 5
  { name: 'Tel Aviv', lng: 34.78, lat: 32.08, minZoom: 5 },
  { name: 'Haifa', lng: 34.99, lat: 32.82, minZoom: 5 },
  { name: 'Beirut', lng: 35.50, lat: 33.89, minZoom: 5 },
  { name: 'Damascus', lng: 36.28, lat: 33.51, minZoom: 5 },
  { name: 'Isfahan', lng: 51.67, lat: 32.65, minZoom: 5 },
  { name: 'Kuwait City', lng: 47.98, lat: 29.38, minZoom: 5 },
  { name: 'Dubai', lng: 55.27, lat: 25.20, minZoom: 5 },
  { name: 'Doha', lng: 51.53, lat: 25.29, minZoom: 5 },
  { name: 'Manama', lng: 50.59, lat: 26.23, minZoom: 5 },
  { name: 'Sanaa', lng: 44.21, lat: 15.35, minZoom: 5 },
  // Visible at zoom >= 7
  { name: 'Jerusalem', lng: 35.22, lat: 31.77, minZoom: 7 },
  { name: 'Nazareth', lng: 35.30, lat: 32.70, minZoom: 7 },
  { name: 'Nablus', lng: 35.26, lat: 32.22, minZoom: 7 },
  { name: 'Hebron', lng: 35.10, lat: 31.53, minZoom: 7 },
  { name: 'Gaza', lng: 34.47, lat: 31.50, minZoom: 7 },
  { name: 'Beersheba', lng: 34.79, lat: 31.25, minZoom: 7 },
  { name: 'Ashdod', lng: 34.65, lat: 31.80, minZoom: 7 },
  { name: 'Ashkelon', lng: 34.57, lat: 31.67, minZoom: 7 },
  { name: 'Natanz', lng: 51.92, lat: 33.51, minZoom: 7 },
  { name: 'Basra', lng: 47.78, lat: 30.51, minZoom: 7 },
  { name: 'Erbil', lng: 44.01, lat: 36.19, minZoom: 7 },
  { name: 'Tyre', lng: 35.19, lat: 33.27, minZoom: 7 },
  { name: 'Sidon', lng: 35.37, lat: 33.56, minZoom: 7 },
  { name: 'Ramallah', lng: 35.21, lat: 31.90, minZoom: 7 },
];

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const EVENTS_SOURCE = "events-source";
const EVENTS_CIRCLES_LAYER = "events-circles";
const EVENTS_GLOW_LAYER = "events-glow";
const EVENTS_ICONS_LAYER = "events-icons";
const HEATMAP_LAYER = "events-heatmap";

const POLYGONS_SOURCE = 'alert-polygons-source';
const POLYGONS_FILL_LAYER = 'alert-polygons-fill';
const POLYGONS_LINE_LAYER = 'alert-polygons-line';

const TRAJECTORIES_SOURCE = 'trajectories-source';
const TRAJECTORIES_LAYER = 'trajectories-line';

const LAUNCH_ORIGINS: Record<string, [number, number]> = {
  iran: [53.0, 32.5],
  lebanon: [35.8, 33.9],
  gaza: [34.47, 31.5],
  yemen: [44.21, 15.35],
  iraq: [44.37, 33.31],
  syria: [36.28, 33.51],
};

// Hebrew alert titles that indicate missile/rocket attacks
const MISSILE_ALERT_TITLES = ['ירי רקטות וטילים', 'חדירת כלי טיס עוין'];

function isMissileEvent(event: { type: string; severity: string; title: string }): boolean {
  if (event.type === 'strike' || event.type === 'missile') return true;
  if (event.type === 'alert' && event.severity === 'critical') {
    return MISSILE_ALERT_TITLES.some((t) => event.title.includes(t));
  }
  return false;
}

function guessOrigin(event: { title: string; lat: number; lng: number }): [number, number] | null {
  const t = event.title.toLowerCase();
  if (t.includes('iran') || t.includes('איראן')) return LAUNCH_ORIGINS.iran;
  if (t.includes('hezbollah') || t.includes('lebanon') || t.includes('חיזבאללה') || t.includes('לבנון')) return LAUNCH_ORIGINS.lebanon;
  if (t.includes('houthi') || t.includes('yemen') || t.includes('חות\'י') || t.includes('תימן')) return LAUNCH_ORIGINS.yemen;
  if (t.includes('gaza') || t.includes('hamas') || t.includes('עזה') || t.includes('חמאס')) return LAUNCH_ORIGINS.gaza;
  if (t.includes('iraq') || t.includes('עיראק')) return LAUNCH_ORIGINS.iraq;
  if (t.includes('syria') || t.includes('סוריה')) return LAUNCH_ORIGINS.syria;
  // If target is in Israel, default origin is Iran (Iran-Israel war context)
  if (event.lat >= 29 && event.lat <= 34 && event.lng >= 34 && event.lng <= 36.5) {
    return LAUNCH_ORIGINS.iran;
  }
  return null;
}

function generateArc(start: [number, number], end: [number, number], numPoints = 50): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lng = start[0] + (end[0] - start[0]) * t;
    const lat = start[1] + (end[1] - start[1]) * t;
    // Add curvature — peak at midpoint, proportional to distance
    const dist = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
    const arcHeight = dist * 0.15;
    const curve = Math.sin(t * Math.PI) * arcHeight;
    points.push([lng, lat + curve]);
  }
  return points;
}

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

  const LIVE_WINDOW_MS: Record<string, number> = { '15m': 15*60*1000, '1h': 60*60*1000, '3h': 3*60*60*1000 };

  // Raw store events for polygon alert status (always show all alerts)
  const allStoreEvents = useAppStore((s) => s.events);

  const filteredEvents = useAppStore(selectFilteredEvents);
  const liveWindow = useAppStore((s) => s.liveWindow);
  const playbackTime = useAppStore((s) => s.playbackTime);

  // Timer to refresh live window filtering periodically
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!liveWindow || playbackTime) return;
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, [liveWindow, playbackTime]);

  // Apply live window time filter on top of state-filtered events
  const events = useMemo(() => {
    if (playbackTime || !liveWindow) return filteredEvents;
    const windowMs = LIVE_WINDOW_MS[liveWindow];
    if (!windowMs) return filteredEvents;
    const cutoff = Date.now() - windowMs;
    return filteredEvents.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEvents, liveWindow, playbackTime]);

  const geoEvents = useMemo(
    () => events.filter((e) => e.lat != null && e.lng != null),
    [events],
  );

  const areaAlertStatus = useMemo(() => {
    const districts = districtsData as Record<string, { areaid: number }>;
    const statusMap = new Map<number, string>();
    const severityRank: Record<string, number> = { critical: 3, moderate: 2, info: 1, cleared: 0 };

    for (const e of allStoreEvents) {
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
  }, [allStoreEvents]);

  const trajectoryGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    for (const e of geoEvents) {
      if (!isMissileEvent(e)) continue;
      const origin = guessOrigin({ title: e.title, lat: e.lat!, lng: e.lng! });
      if (!origin) continue;
      const target: [number, number] = [e.lng!, e.lat!];
      const arc = generateArc(origin, target);
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: arc },
        properties: { severity: e.severity },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [geoEvents]);

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

      CITY_LABELS.forEach(({ name, lng, lat, minZoom }) => {
        const el = document.createElement('div');
        el.className = 'flex items-center gap-1 pointer-events-none select-none';
        el.style.whiteSpace = 'nowrap';

        const dot = document.createElement('span');
        dot.style.cssText = 'width:4px;height:4px;border-radius:50%;background:#9ca3af;display:inline-block';
        const label = document.createElement('span');
        label.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.5);font-weight:500';
        label.textContent = name;
        el.appendChild(dot);
        el.appendChild(label);

        new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        // Hide markers below their minimum zoom
        if (minZoom) {
          const updateVisibility = () => {
            el.style.display = map.getZoom() >= minZoom ? '' : 'none';
          };
          updateVisibility();
          map.on('zoom', updateVisibility);
        }
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

      // Heatmap density layer (bottommost visual layer)
      map.addLayer({
        id: HEATMAP_LAYER,
        type: "heatmap",
        source: EVENTS_SOURCE,
        paint: {
          "heatmap-weight": [
            "match",
            ["get", "severity"],
            "critical", 1,
            "moderate", 0.6,
            "info", 0.3,
            "cleared", 0.1,
            0.3,
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-intensity": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.5,
            9, 2,
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, 15,
            9, 30,
          ] as unknown as maplibregl.ExpressionSpecification,
          "heatmap-opacity": 0.4,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "transparent",
            0.2, "#3b82f6",
            0.4, "#22c55e",
            0.6, "#f97316",
            0.8, "#ef4444",
            1, "#ffffff",
          ] as unknown as maplibregl.ExpressionSpecification,
        },
      });

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

      // Icon overlay for event types
      map.addLayer({
        id: EVENTS_ICONS_LAYER,
        type: "symbol",
        source: EVENTS_SOURCE,
        layout: {
          "text-field": [
            "match",
            ["get", "type"],
            "strike", "\u{1F4A5}",
            "alert", "\u26A0",
            "thermal", "\u{1F525}",
            "flight", "\u2708",
            "missile", "\u{1F680}",
            "seismic", "\u3030",
            "news", "\u{1F4F0}",
            "social", "\u{1F4AC}",
            "ship", "\u{1F6A2}",
            "",
          ] as unknown as maplibregl.ExpressionSpecification,
          "text-size": [
            "match",
            ["get", "severity"],
            "critical", 14,
            "moderate", 12,
            10,
          ] as unknown as maplibregl.ExpressionSpecification,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-opacity": 0.9,
        },
      });

      // Popup on click (circles + icons)
      const severityLabels: Record<string, string> = {
        critical: '🔴 CRITICAL', moderate: '🟠 MODERATE', info: '🔵 INFO', cleared: '🟢 CLEARED',
      };
      const typeLabels: Record<string, string> = {
        alert: '⚠️ Alert', strike: '💥 Strike', thermal: '🔥 Thermal', flight: '✈️ Flight',
        missile: '🚀 Missile', seismic: '〰️ Seismic', news: '📰 News', social: '💬 Social', ship: '🚢 Ship',
      };
      const handlePopupClick = (e: maplibregl.MapLayerMouseEvent) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const p = feature.properties as Record<string, string>;
        const time = p.timestamp ? timeAgo(p.timestamp) : "";
        const sevLabel = severityLabels[p.severity] ?? p.severity;
        const typeLabel = typeLabels[p.type] ?? p.type;

        new maplibregl.Popup({ closeButton: true, className: "event-popup", maxWidth: "320px" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:12px;line-height:1.4">` +
            `<div style="margin-bottom:4px"><strong>${p.title}</strong></div>` +
            `<div style="margin-bottom:4px;opacity:0.8">${sevLabel} &middot; ${typeLabel}</div>` +
            (p.locationName ? `<div style="margin-bottom:4px">📍 ${p.locationName}</div>` : "") +
            `<div style="opacity:0.6">Source: <strong>${p.source}</strong>${time ? ` &middot; ${time}` : ""}</div>` +
            (p.timestamp ? `<div style="opacity:0.5;font-size:10px;margin-top:2px">${new Date(p.timestamp).toLocaleString()}</div>` : "") +
            `</div>`,
          )
          .addTo(map);
      };
      map.on("click", EVENTS_CIRCLES_LAYER, handlePopupClick);
      map.on("click", EVENTS_ICONS_LAYER, handlePopupClick);

      // Cursor changes on hover
      const setCursorPointer = () => { map.getCanvas().style.cursor = "pointer"; };
      const setCursorDefault = () => { map.getCanvas().style.cursor = ""; };
      map.on("mouseenter", EVENTS_CIRCLES_LAYER, setCursorPointer);
      map.on("mouseleave", EVENTS_CIRCLES_LAYER, setCursorDefault);
      map.on("mouseenter", EVENTS_ICONS_LAYER, setCursorPointer);
      map.on("mouseleave", EVENTS_ICONS_LAYER, setCursorDefault);
    }
  }, [geoEvents, mapReady]);

  // --- Alert zone polygons (static import, no async fetch) ---
  const polygonGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const base = polygonsData as unknown as GeoJSON.FeatureCollection;
    return {
      type: 'FeatureCollection',
      features: base.features.map((feature) => {
        const areaid = (feature.properties as Record<string, unknown>)?.areaid as number;
        const severity = areaAlertStatus.get(areaid) ?? 'none';
        return {
          ...feature,
          properties: { ...feature.properties, severity },
        };
      }),
    };
  }, [areaAlertStatus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource(POLYGONS_SOURCE) as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(polygonGeojson);
    } else {
      map.addSource(POLYGONS_SOURCE, { type: 'geojson', data: polygonGeojson });

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
              'rgba(0,0,0,0)',
            ] as unknown as maplibregl.ExpressionSpecification,
            'fill-opacity': [
              'match',
              ['get', 'severity'],
              'critical', 0.35,
              'moderate', 0.3,
              'info', 0.2,
              'cleared', 0.15,
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
              'rgba(0,0,0,0)',
            ] as unknown as maplibregl.ExpressionSpecification,
            'line-width': 2,
            'line-opacity': [
              'match',
              ['get', 'severity'],
              'critical', 0.8,
              'moderate', 0.6,
              'info', 0.4,
              'cleared', 0.3,
              0,
            ] as unknown as maplibregl.ExpressionSpecification,
          },
        },
        beforeLayer,
      );
    }
  }, [polygonGeojson, mapReady]);

  // --- Missile/strike trajectory arcs ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource(TRAJECTORIES_SOURCE) as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(trajectoryGeojson);
    } else {
      map.addSource(TRAJECTORIES_SOURCE, { type: 'geojson', data: trajectoryGeojson });

      // Insert above polygon layers but below event glow/circles
      const beforeLayer = map.getLayer(EVENTS_GLOW_LAYER) ? EVENTS_GLOW_LAYER : undefined;

      map.addLayer(
        {
          id: TRAJECTORIES_LAYER,
          type: 'line',
          source: TRAJECTORIES_SOURCE,
          paint: {
            'line-color': [
              'match',
              ['get', 'severity'],
              'critical', '#ef4444',
              'moderate', '#f97316',
              '#ef4444',
            ] as unknown as maplibregl.ExpressionSpecification,
            'line-width': 1.8,
            'line-opacity': 0.6,
            'line-dasharray': [2, 2],
          },
        },
        beforeLayer,
      );
    }
  }, [trajectoryGeojson, mapReady]);

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
