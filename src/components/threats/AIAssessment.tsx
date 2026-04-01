'use client';

import { useAppStore } from '@/lib/store';

export default function AIAssessment() {
  const threat = useAppStore((s) => s.threat);

  if (!threat) {
    return (
      <div className="px-3 py-2 text-xs text-muted">
        Awaiting AI assessment...
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-3 text-xs">
      <div>
        <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
          Current Situation
        </div>
        <p className="text-foreground/80 leading-relaxed">{threat.situationText}</p>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
          Recent Trend
        </div>
        <p className="text-foreground/80 leading-relaxed">{threat.trendText}</p>
      </div>
      <div>
        <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1">
          Overall
        </div>
        <p className="text-foreground/80 leading-relaxed">{threat.overallText}</p>
      </div>
    </div>
  );
}
