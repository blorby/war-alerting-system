'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export default function AnnouncementBanner() {
  const announcement = useAppStore((s) => s.announcement);
  const dismissed = useAppStore((s) => s.announcementDismissed);
  const fetchAnnouncement = useAppStore((s) => s.fetchAnnouncement);
  const dismissAnnouncement = useAppStore((s) => s.dismissAnnouncement);

  useEffect(() => {
    fetchAnnouncement();
  }, [fetchAnnouncement]);

  if (!announcement || dismissed) return null;

  return (
    <div className="flex items-start gap-3 px-4 py-2 bg-surface-elevated border-b border-border text-xs text-foreground/80">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5 text-info">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <p className="flex-1 leading-relaxed">{announcement.text}</p>
      <button onClick={dismissAnnouncement} className="shrink-0 p-1 text-muted hover:text-foreground transition-colors" title="Dismiss announcement">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
