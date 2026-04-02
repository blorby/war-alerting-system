"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/geo/regions";
import { useAppStore, selectFilteredEvents } from "@/lib/store";
import { EVENT_TYPES } from "@/lib/constants";
import districtsData from '@/lib/geo/districts.json';
import cityPolygonsData from '@/lib/geo/city-polygons.json';
import MapFocus from "./MapFocus";
import MapLayers from "./MapLayers";
import MapLegend from "./MapLegend";
import { computeEventCredibility, getCredibilityLevel } from "@/lib/credibility";

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
const POLYGONS_ICONS_SOURCE = 'alert-polygons-icons-source';
const POLYGONS_ICONS_LAYER = 'alert-polygons-icons';

const TRAJECTORIES_SOURCE = 'trajectories-source';
const TRAJECTORIES_LAYER = 'trajectories-line';

const HIT_ZONES_SOURCE = 'hit-zones-source';
const HIT_ZONES_LAYER = 'hit-zones-fill';
const HIT_ZONES_RING_LAYER = 'hit-zones-ring';

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

// Map ORef alert titles to icon categories
function alertTitleToIcon(title: string): string {
  if (title.includes('ירי רקטות וטילים')) return '\u{1F680}'; // 🚀 missile
  if (title.includes('חדירת כלי טיס עוין')) return '\u{1F6E9}'; // 🛩 drone/UAV
  if (title.includes('חדירת מחבלים')) return '\u{1F52B}'; // 🔫 infiltration
  if (title.includes('רעידת אדמה')) return '\u3030'; // 〰 seismic
  if (title.includes('צונאמי')) return '\u{1F30A}'; // 🌊 tsunami
  if (title.includes('חומרים מסוכנים')) return '\u2623'; // ☣ hazmat
  return '\u26A0'; // ⚠ generic alert
}

function isMissileEvent(event: { type: string; severity: string; title: string }): boolean {
  if (event.type === 'strike' || event.type === 'missile') return true;
  if (event.type === 'alert' && event.severity === 'critical') {
    return MISSILE_ALERT_TITLES.some((t) => event.title.includes(t));
  }
  return false;
}

function guessOrigin(event: { title: string; lat: number; lng: number }): [number, number] | null {
  const t = event.title.toLowerCase();
  // Explicit origin keywords in title
  if (t.includes('iran') || t.includes('איראן')) return LAUNCH_ORIGINS.iran;
  if (t.includes('hezbollah') || t.includes('lebanon') || t.includes('חיזבאללה') || t.includes('לבנון')) return LAUNCH_ORIGINS.lebanon;
  if (t.includes('houthi') || t.includes('yemen') || t.includes('חות\'י') || t.includes('תימן')) return LAUNCH_ORIGINS.yemen;
  if (t.includes('gaza') || t.includes('hamas') || t.includes('עזה') || t.includes('חמאס')) return LAUNCH_ORIGINS.gaza;
  if (t.includes('iraq') || t.includes('עיראק')) return LAUNCH_ORIGINS.iraq;
  if (t.includes('syria') || t.includes('סוריה')) return LAUNCH_ORIGINS.syria;
  // If target is in Israel, guess origin by geographic proximity to borders
  if (event.lat >= 29 && event.lat <= 34 && event.lng >= 34 && event.lng <= 36.5) {
    // Golan Heights / northeast — likely Syria
    if (event.lat >= 32.5 && event.lng >= 35.5) return LAUNCH_ORIGINS.syria;
    // Northern border strip — likely Lebanon
    if (event.lat >= 32.8) return LAUNCH_ORIGINS.lebanon;
    // South — near Gaza border
    if (event.lat <= 31.6 && event.lng <= 34.8) return LAUNCH_ORIGINS.gaza;
    // Central/south Israel, far from any short-range border — likely Iran or Yemen
    return null;
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

  const events = useAppStore(selectFilteredEvents);
  const playbackTime = useAppStore((s) => s.playbackTime);

  const geoEvents = useMemo(
    () => events.filter((e) => e.lat != null && e.lng != null),
    [events],
  );

  const cityAlertStatus = useMemo(() => {
    const districts = districtsData as Record<string, { areaid: number }>;
    const statusMap = new Map<string, string>();   // cityName → severity
    const iconMap = new Map<string, string>();      // cityName → icon emoji
    const areaFallback = new Map<number, string>(); // areaid → severity (for unmatched polygons)
    const areaIconFallback = new Map<number, string>(); // areaid → icon emoji
    const severityRank: Record<string, number> = { critical: 3, moderate: 2, info: 1, cleared: 0 };
    const CLEARED_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

    const securityTypes = new Set(['alert', 'strike', 'missile', 'thermal']);
    const now = playbackTime ? playbackTime.getTime() : Date.now();

    for (const e of events) {
      if (!securityTypes.has(e.type)) continue;

      const name = e.locationName;
      if (!name) continue;

      const newRank = severityRank[e.severity] ?? 0;

      // Direct city name match
      if (e.isActive) {
        const current = statusMap.get(name);
        const currentRank = current ? (severityRank[current] ?? 0) : -1;
        if (newRank > currentRank) {
          statusMap.set(name, e.severity);
          iconMap.set(name, alertTitleToIcon(e.title));
        }
      } else if (!statusMap.has(name)) {
        // Show 'cleared' (green "ok to leave") for 15 minutes after event ended
        const eventTime = new Date(e.timestamp).getTime();
        if (now - eventTime <= CLEARED_WINDOW_MS) {
          statusMap.set(name, 'cleared');
          iconMap.set(name, '\u2705'); // ✅ ok to leave
        }
      }

      // Also track areaid for fallback
      const areaid = districts[name]?.areaid;
      if (areaid) {
        if (e.isActive) {
          const currentArea = areaFallback.get(areaid);
          const currentAreaRank = currentArea ? (severityRank[currentArea] ?? 0) : -1;
          if (newRank > currentAreaRank) {
            areaFallback.set(areaid, e.severity);
            areaIconFallback.set(areaid, alertTitleToIcon(e.title));
          }
        } else if (!areaFallback.has(areaid)) {
          const eventTime = new Date(e.timestamp).getTime();
          if (now - eventTime <= CLEARED_WINDOW_MS) {
            areaFallback.set(areaid, 'cleared');
            areaIconFallback.set(areaid, '\u2705');
          }
        }
      }
    }

    return { statusMap, iconMap, areaFallback, areaIconFallback };
  }, [events, playbackTime]);

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

  // Hit zone circles for strike/missile/alert events — generates small circular polygons
  const hitZoneGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const hitTypes = new Set(['strike', 'missile', 'alert']);
    const features: GeoJSON.Feature[] = [];

    for (const e of geoEvents) {
      if (!hitTypes.has(e.type)) continue;
      if (e.severity === 'cleared') continue;

      // Radius in degrees (~2km for critical, ~1km for others)
      const radius = e.severity === 'critical' ? 0.02 : 0.01;
      const segments = 32;
      const coords: [number, number][] = [];
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * 2 * Math.PI;
        coords.push([
          e.lng! + radius * Math.cos(angle) * 1.2, // stretch slightly for lng
          e.lat! + radius * Math.sin(angle),
        ]);
      }

      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: { severity: e.severity, type: e.type },
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
    // Expose for debugging
    (window as unknown as Record<string, unknown>).__map = map;

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
          corroborated: e.corroborated ? "true" : "false",
          credibility: String(computeEventCredibility(e.source, e.corroborated)),
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

        const credScore = Number(p.credibility) || 0;
        const credColor = credScore >= 70 ? '#4ade80' : credScore >= 45 ? '#facc15' : '#fb923c';
        const credBg = credScore >= 70 ? 'rgba(34,197,94,0.2)' : credScore >= 45 ? 'rgba(234,179,8,0.2)' : 'rgba(249,115,22,0.2)';
        const credLabel = credScore >= 70 ? 'HIGH' : credScore >= 45 ? 'MEDIUM' : 'LOW';
        const reliabilityTag = `<span style="background:${credBg};color:${credColor};padding:1px 4px;border-radius:3px;font-size:9px;font-weight:bold">${credScore}% CREDIBILITY \u2014 ${credLabel}</span>`;

        new maplibregl.Popup({ closeButton: true, className: "event-popup", maxWidth: "320px" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:12px;line-height:1.4">` +
            `<div style="margin-bottom:4px"><strong>${p.title}</strong></div>` +
            `<div style="margin-bottom:4px;opacity:0.8">${sevLabel} &middot; ${typeLabel}</div>` +
            `<div style="margin-bottom:4px">${reliabilityTag}</div>` +
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
    const base = cityPolygonsData as unknown as GeoJSON.FeatureCollection;
    const { statusMap, iconMap, areaFallback, areaIconFallback } = cityAlertStatus;
    return {
      type: 'FeatureCollection',
      features: base.features.map((feature) => {
        const props = feature.properties as Record<string, unknown>;
        const name = props?.name as string;
        const areaid = props?.areaid as number | null;

        // Try direct city name match first, then areaid fallback
        const severity = statusMap.get(name)
          ?? (areaid ? areaFallback.get(areaid) : undefined)
          ?? 'none';
        const alertIcon = iconMap.get(name)
          ?? (areaid ? areaIconFallback.get(areaid) : undefined)
          ?? '';

        return {
          ...feature,
          properties: { ...props, severity, alertIcon },
        };
      }),
    };
  }, [cityAlertStatus]);

  // Point features at polygon centroids for alert type icons
  const polygonIconsGeojson = useMemo<GeoJSON.FeatureCollection>(() => {
    const features: GeoJSON.Feature[] = [];
    for (const feature of polygonGeojson.features) {
      const props = feature.properties as Record<string, unknown>;
      if (!props?.alertIcon || props.severity === 'none') continue;

      // Compute centroid of polygon
      const coords = (feature.geometry as GeoJSON.Polygon).coordinates?.[0];
      if (!coords || coords.length < 3) continue;
      let sumLng = 0, sumLat = 0;
      const n = coords.length - 1; // exclude closing point
      for (let i = 0; i < n; i++) {
        sumLng += coords[i][0];
        sumLat += coords[i][1];
      }

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [sumLng / n, sumLat / n] },
        properties: { alertIcon: props.alertIcon, severity: props.severity },
      });
    }
    return { type: 'FeatureCollection', features };
  }, [polygonGeojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource(POLYGONS_SOURCE) as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(polygonGeojson);
    } else {
      map.addSource(POLYGONS_SOURCE, { type: 'geojson', data: polygonGeojson });

      const beforeLayer = map.getLayer(EVENTS_GLOW_LAYER) ? EVENTS_GLOW_LAYER : undefined;

      // Place polygons ABOVE heatmap for visibility
      map.addLayer(
        {
          id: POLYGONS_FILL_LAYER,
          type: 'fill',
          source: POLYGONS_SOURCE,
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'severity'], 'critical'], '#ef4444',
              ['==', ['get', 'severity'], 'moderate'], '#f97316',
              ['==', ['get', 'severity'], 'info'], '#3b82f6',
              ['==', ['get', 'severity'], 'cleared'], '#22c55e',
              '#6b7280',
            ] as unknown as maplibregl.ExpressionSpecification,
            'fill-opacity': [
              'case',
              ['==', ['get', 'severity'], 'critical'], 0.45,
              ['==', ['get', 'severity'], 'moderate'], 0.35,
              ['==', ['get', 'severity'], 'info'], 0.25,
              ['==', ['get', 'severity'], 'cleared'], 0.35,
              0.0, // inactive polygons hidden (zoom filtering not supported inside case)
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
              'case',
              ['==', ['get', 'severity'], 'critical'], '#ef4444',
              ['==', ['get', 'severity'], 'moderate'], '#f97316',
              ['==', ['get', 'severity'], 'info'], '#3b82f6',
              ['==', ['get', 'severity'], 'cleared'], '#22c55e',
              '#6b7280',
            ] as unknown as maplibregl.ExpressionSpecification,
            'line-width': [
              'case',
              ['==', ['get', 'severity'], 'none'], 0.5,
              2.5,
            ] as unknown as maplibregl.ExpressionSpecification,
            'line-opacity': [
              'case',
              ['==', ['get', 'severity'], 'critical'], 0.9,
              ['==', ['get', 'severity'], 'moderate'], 0.7,
              ['==', ['get', 'severity'], 'info'], 0.5,
              ['==', ['get', 'severity'], 'cleared'], 0.7,
              0.0, // inactive polygons hidden
            ] as unknown as maplibregl.ExpressionSpecification,
          },
        },
        beforeLayer,
      );
    }
  }, [polygonGeojson, mapReady]);

  // --- Alert zone type icons (rendered at polygon centroids) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource(POLYGONS_ICONS_SOURCE) as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(polygonIconsGeojson);
    } else {
      map.addSource(POLYGONS_ICONS_SOURCE, { type: 'geojson', data: polygonIconsGeojson });

      map.addLayer({
        id: POLYGONS_ICONS_LAYER,
        type: 'symbol',
        source: POLYGONS_ICONS_SOURCE,
        layout: {
          'text-field': ['get', 'alertIcon'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 10, 18],
          'text-allow-overlap': true,
          'text-ignore-placement': false,
        },
        paint: {
          'text-opacity': 0.9,
        },
      });
    }
  }, [polygonIconsGeojson, mapReady]);

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

  // --- Hit zone circles for strikes/missiles ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source = map.getSource(HIT_ZONES_SOURCE) as maplibregl.GeoJSONSource | undefined;

    if (source) {
      source.setData(hitZoneGeojson);
    } else {
      map.addSource(HIT_ZONES_SOURCE, { type: 'geojson', data: hitZoneGeojson });

      const beforeLayer = map.getLayer(EVENTS_GLOW_LAYER) ? EVENTS_GLOW_LAYER : undefined;

      // Translucent fill for hit zone
      map.addLayer(
        {
          id: HIT_ZONES_LAYER,
          type: 'fill',
          source: HIT_ZONES_SOURCE,
          paint: {
            'fill-color': [
              'match',
              ['get', 'severity'],
              'critical', '#ef4444',
              'moderate', '#f97316',
              '#3b82f6',
            ] as unknown as maplibregl.ExpressionSpecification,
            'fill-opacity': [
              'match',
              ['get', 'severity'],
              'critical', 0.2,
              'moderate', 0.15,
              0.1,
            ] as unknown as maplibregl.ExpressionSpecification,
          },
        },
        beforeLayer,
      );

      // Pulsing ring outline
      map.addLayer(
        {
          id: HIT_ZONES_RING_LAYER,
          type: 'line',
          source: HIT_ZONES_SOURCE,
          paint: {
            'line-color': [
              'match',
              ['get', 'severity'],
              'critical', '#ef4444',
              'moderate', '#f97316',
              '#3b82f6',
            ] as unknown as maplibregl.ExpressionSpecification,
            'line-width': 1.5,
            'line-opacity': 0.6,
            'line-dasharray': [3, 3],
          },
        },
        beforeLayer,
      );
    }
  }, [hitZoneGeojson, mapReady]);

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
        <MapLayers mapRef={mapRef} />
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
