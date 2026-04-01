"use client";

import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import NewsTicker from "@/components/layout/NewsTicker";
import AlertFeed from "@/components/alerts/AlertFeed";
import ThreatPanel from "@/components/threats/ThreatPanel";
import TimelineBar from "@/components/timeline/TimelineBar";

// MapContainer uses maplibre-gl which requires window, so load it client-only
const MapContainer = dynamic(() => import("@/components/map/MapContainer"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-background">
      <span className="text-sm text-muted">Loading map...</span>
    </div>
  ),
});

export default function Dashboard() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <Header isLive={true} lastUpdate={new Date()} />

      {/* Main content: sidebar + map */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar>
          <AlertFeed />
          <ThreatPanel />
        </Sidebar>
        <MapContainer />
      </div>

      {/* Timeline */}
      <TimelineBar isLive={true} currentTime={new Date()} />

      {/* News ticker */}
      <NewsTicker />
    </div>
  );
}
