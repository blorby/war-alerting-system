'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import PanelContainer from './PanelContainer';

const timeAgo = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `about ${hrs} hours ago`;
  return `${Math.floor(hrs / 24)} days ago`;
};

type TabFilter = 'all' | 'news' | 'official statement';

export default function NewsFeedPanel() {
  const news = useAppStore((s) => s.news);
  const [tab, setTab] = useState<TabFilter>('all');

  const filtered = tab === 'all' ? news : news.filter((n) => n.category === tab);

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 22h16a2 2 0 002-2V4a2 2 0 00-2-2H8a2 2 0 00-2 2v16a2 2 0 01-2 2zm0 0a2 2 0 01-2-2v-9c0-1.1.9-2 2-2h2" />
    </svg>
  );

  const tabs = (
    <div className="flex gap-1">
      {(['all', 'news', 'official statement'] as TabFilter[]).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
            tab === t
              ? 'bg-info/20 text-info'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {t === 'official statement' ? 'Official' : t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );

  return (
    <PanelContainer title="News Feed" icon={icon} actions={tabs}>
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-muted text-center py-4">No news items</p>
        )}
        {filtered.map((item) => (
          <div key={item.id} className="border-b border-border pb-1.5 last:border-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info hover:underline leading-tight block truncate"
                  >
                    {item.title}
                  </a>
                ) : (
                  <span className="text-foreground leading-tight block truncate">{item.title}</span>
                )}
                <div className="flex items-center gap-1.5 mt-0.5 text-muted">
                  <span className="font-medium">{item.source}</span>
                  <span>·</span>
                  <span>{timeAgo(item.timestamp)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PanelContainer>
  );
}
