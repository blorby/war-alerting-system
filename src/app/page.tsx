"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import AnnouncementBanner from "@/components/layout/AnnouncementBanner";
import Sidebar from "@/components/layout/Sidebar";
import NewsTicker from "@/components/layout/NewsTicker";
import FrontFilter from "@/components/filters/FrontFilter";
import TypeFilter from "@/components/filters/TypeFilter";
import CredibilityFilter from "@/components/filters/CredibilityFilter";
import AlertFeed from "@/components/alerts/AlertFeed";
import ThreatPanel from "@/components/threats/ThreatPanel";
import TimelineBar from "@/components/timeline/TimelineBar";
import BottomPanels from "@/components/panels/BottomPanels";
import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n/useT";

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
  const t = useT();
  const isLive = useAppStore((s) => s.isLive);
  const lastUpdate = useAppStore((s) => s.lastUpdate);
  const fetchEvents = useAppStore((s) => s.fetchEvents);
  const fetchThreat = useAppStore((s) => s.fetchThreat);
  const fetchTicker = useAppStore((s) => s.fetchTicker);
  const fetchThreatHistory = useAppStore((s) => s.fetchThreatHistory);
  const connectSSE = useAppStore((s) => s.connectSSE);
  const disconnectSSE = useAppStore((s) => s.disconnectSSE);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelsOpen, setPanelsOpen] = useState(false);

  useEffect(() => {
    fetchEvents();
    fetchThreat();
    fetchTicker();
    fetchThreatHistory('24h');
    connectSSE();

    const threatInterval = setInterval(() => {
      fetchThreat();
      fetchThreatHistory('24h');
    }, 60_000);

    return () => {
      clearInterval(threatInterval);
      disconnectSSE();
    };
  }, [fetchEvents, fetchThreat, fetchTicker, fetchThreatHistory, connectSSE, disconnectSSE]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <Header
        isLive={isLive}
        lastUpdate={lastUpdate}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      <AnnouncementBanner />

      {/* Main content: sidebar + map */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)}>
          <FrontFilter />
          <TypeFilter />
          <CredibilityFilter />
          <AlertFeed />
          <ThreatPanel />
        </Sidebar>
        <MapContainer />
      </div>

      {/* Mobile panels toggle tab */}
      <button
        onClick={() => setPanelsOpen(!panelsOpen)}
        className={`md:hidden flex items-center justify-center gap-1.5 border-t border-border bg-surface px-4 py-1.5 text-xs transition-colors ${
          panelsOpen ? "text-info" : "text-muted"
        }`}
      >
        <svg
          className={`h-3 w-3 transition-transform ${panelsOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
        {panelsOpen ? t("panels.lessInfo") : t("panels.moreInfo")}
      </button>

      {/* Bottom panels — hidden on mobile unless toggled */}
      <div className={`${panelsOpen ? "" : "hidden"} md:block`}>
        <BottomPanels />
      </div>

      {/* Timeline */}
      <TimelineBar isLive={isLive} />

      {/* News ticker — hidden on mobile */}
      <div className="hidden md:block">
        <NewsTicker />
      </div>
    </div>
  );
}
