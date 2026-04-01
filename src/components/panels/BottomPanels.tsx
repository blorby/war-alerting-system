'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import NewsFeedPanel from './NewsFeedPanel';
import DefenseNewsPanel from './DefenseNewsPanel';
import NewsDigestPanel from './NewsDigestPanel';
import PredictionMarketsPanel from './PredictionMarketsPanel';
import SocialMonitorPanel from './SocialMonitorPanel';
import MissileCountsPanel from './MissileCountsPanel';
import FlightTrackerPanel from './FlightTrackerPanel';

export default function BottomPanels() {
  const fetchNews = useAppStore((s) => s.fetchNews);
  const fetchSocial = useAppStore((s) => s.fetchSocial);
  const fetchFlights = useAppStore((s) => s.fetchFlights);
  const fetchDigest = useAppStore((s) => s.fetchDigest);
  const fetchMissileCounts = useAppStore((s) => s.fetchMissileCounts);

  useEffect(() => {
    fetchNews();
    fetchSocial();
    fetchFlights();
    fetchDigest();
    fetchMissileCounts();
    const interval = setInterval(() => {
      fetchNews();
      fetchSocial();
      fetchFlights();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchNews, fetchSocial, fetchFlights, fetchDigest, fetchMissileCounts]);

  return (
    <div className="h-64 border-t border-border bg-background shrink-0 overflow-hidden">
      <div className="flex h-full gap-px bg-border">
        <div className="flex-1 min-w-0 bg-background"><NewsFeedPanel /></div>
        <div className="flex-1 min-w-0 bg-background"><DefenseNewsPanel /></div>
        <div className="flex-1 min-w-0 bg-background"><NewsDigestPanel /></div>
        <div className="flex-1 min-w-0 bg-background"><PredictionMarketsPanel /></div>
        <div className="flex-1 min-w-0 bg-background"><SocialMonitorPanel /></div>
        <div className="flex-1 min-w-0 bg-background"><MissileCountsPanel /></div>
        <div className="flex-1 min-w-0 bg-background"><FlightTrackerPanel /></div>
      </div>
    </div>
  );
}
