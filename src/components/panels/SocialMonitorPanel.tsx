'use client';

import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n/useT';
import PanelContainer from './PanelContainer';

function PlatformIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === 'telegram') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-info shrink-0">
        <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm5.53 8.15l-1.79 8.47c-.13.6-.49.74-.99.46l-2.74-2.02-1.32 1.27c-.15.15-.27.27-.55.27l.2-2.77 5.05-4.56c.22-.2-.05-.3-.34-.12l-6.24 3.93-2.69-.84c-.58-.18-.6-.58.12-.86l10.52-4.06c.49-.18.91.12.76.83z" />
      </svg>
    );
  }
  if (p === 'twitter' || p === 'x') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-foreground shrink-0">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted shrink-0">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

export default function SocialMonitorPanel() {
  const t = useT();
  const socialPosts = useAppStore((s) => s.socialPosts);

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );

  return (
    <PanelContainer title={t('panels.socialMonitor')} icon={icon}>
      <div className="space-y-2">
        {socialPosts.length === 0 && (
          <p className="text-muted text-center py-4">{t('panels.noSocial')}</p>
        )}
        {socialPosts.map((post) => (
          <div key={post.id} className="border-b border-border pb-1.5 last:border-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <PlatformIcon platform={post.platform} />
              <a
                href={post.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-info hover:underline font-medium truncate"
              >
                {post.channel}
              </a>
              <span
                className={`px-1 py-0 rounded text-[9px] font-semibold ${
                  post.verified
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {post.verified ? t('panels.verified') : t('panels.unverified')}
              </span>
            </div>
            <p className="text-foreground leading-tight line-clamp-2">{post.text}</p>
            <div className="flex items-center justify-between mt-0.5 text-muted">
              <span>{timeAgo(post.timestamp, t)}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px]">{post.credibility}% {t('panels.credibility')}</span>
                {post.messageUrl && (
                  <a
                    href={post.messageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-info hover:underline text-[10px]"
                  >
                    {t('panels.source')}
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PanelContainer>
  );
}

function timeAgo(ts: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('time.justNow');
  if (mins < 60) return t('time.minutesLong', { n: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('time.hoursLong', { n: hrs });
  return t('time.daysLong', { n: Math.floor(hrs / 24) });
}
