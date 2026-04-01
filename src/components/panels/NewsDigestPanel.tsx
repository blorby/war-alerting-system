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

export default function NewsDigestPanel() {
  const digest = useAppStore((s) => s.digest);
  const fetchDigest = useAppStore((s) => s.fetchDigest);

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );

  const actions = (
    <button
      onClick={() => fetchDigest()}
      className="p-1 text-muted hover:text-foreground transition-colors"
      title="Regenerate digest"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
      </svg>
    </button>
  );

  return (
    <PanelContainer title="News Digest" icon={icon} actions={actions}>
      {!digest ? (
        <p className="text-muted text-center py-4">No digest available</p>
      ) : (
        <div className="space-y-2">
          <h3 className="text-foreground font-medium leading-tight">{digest.summary}</h3>
          <ul className="space-y-1 list-disc list-inside text-muted">
            {digest.bullets.map((bullet, i) => (
              <li key={i} className="leading-tight">{bullet}</li>
            ))}
          </ul>
          <p className="text-muted/60 text-[10px] mt-1">
            Generated {timeAgo(digest.generatedAt)}
          </p>
        </div>
      )}
    </PanelContainer>
  );
}
