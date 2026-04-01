"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import AnnouncementBanner from "@/components/layout/AnnouncementBanner";
import Sidebar from "@/components/layout/Sidebar";
import NewsTicker from "@/components/layout/NewsTicker";
import FrontFilter from "@/components/filters/FrontFilter";
import TypeFilter from "@/components/filters/TypeFilter";
import AlertFeed from "@/components/alerts/AlertFeed";
import ThreatPanel from "@/components/threats/ThreatPanel";
import TimelineBar from "@/components/timeline/TimelineBar";
import { useAppStore } from "@/lib/store";

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
  const isLive = useAppStore((s) => s.isLive);
  const lastUpdate = useAppStore((s) => s.lastUpdate);
  const fetchEvents = useAppStore((s) => s.fetchEvents);
  const fetchThreat = useAppStore((s) => s.fetchThreat);
  const fetchTicker = useAppStore((s) => s.fetchTicker);
  const connectSSE = useAppStore((s) => s.connectSSE);
  const disconnectSSE = useAppStore((s) => s.disconnectSSE);

  useEffect(() => {
    fetchEvents();
    fetchThreat();
    fetchTicker();
    connectSSE();

    const threatInterval = setInterval(fetchThreat, 60_000);

    return () => {
      clearInterval(threatInterval);
      disconnectSSE();
    };
  }, [fetchEvents, fetchThreat, fetchTicker, connectSSE, disconnectSSE]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <Header isLive={isLive} lastUpdate={lastUpdate} />
      <AnnouncementBanner />

      {/* Main content: sidebar + map */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar>
          <FrontFilter />
          <TypeFilter />
          <AlertFeed />
          <ThreatPanel />
        </Sidebar>
        <MapContainer />
      </div>

      {/* Timeline */}
      <TimelineBar isLive={isLive} />

      {/* News ticker */}
      <NewsTicker />
    </div>
  );
}
