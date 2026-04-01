'use client';

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

export default function DefenseNewsPanel() {
  const news = useAppStore((s) => s.news);

  const defenseNews = news.filter((item) => {
    const src = item.source.toLowerCase();
    const cat = item.category.toLowerCase();
    return (
      src.includes('centcom') ||
      src.includes('nato') ||
      src.includes('defense') ||
      cat === 'iran_military' ||
      cat === 'defense'
    );
  });

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );

  return (
    <PanelContainer title="Defense News" icon={icon}>
      <div className="space-y-2">
        {defenseNews.length === 0 && (
          <p className="text-muted text-center py-4">No defense news</p>
        )}
        {defenseNews.map((item) => (
          <div key={item.id} className="border-b border-border pb-1.5 last:border-0">
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
        ))}
      </div>
    </PanelContainer>
  );
}
