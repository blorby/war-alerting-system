"use client";

import { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "@/lib/geo/regions";
import MapFocus from "./MapFocus";
import MapLayers from "./MapLayers";
import MapLegend from "./MapLegend";

const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function MapContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

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
      "bottom-right"
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

  const handleFocusChange = (bounds: [[number, number], [number, number]]) => {
    mapRef.current?.fitBounds(bounds, { padding: 50, duration: 1000 });
  };

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
