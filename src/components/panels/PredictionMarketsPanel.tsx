'use client';

import { useAppStore } from '@/lib/store';
import PanelContainer from './PanelContainer';

export default function PredictionMarketsPanel() {
  const threat = useAppStore((s) => s.threat);

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );

  return (
    <PanelContainer title="AI Implications" icon={icon}>
      {!threat ? (
        <p className="text-muted text-center py-4">No threat assessment available</p>
      ) : (
        <div className="space-y-2">
          <p className="text-foreground leading-tight">{threat.overallText}</p>
          <ul className="space-y-1 list-disc list-inside text-muted">
            <li className="leading-tight">{threat.situationText}</li>
            <li className="leading-tight">{threat.trendText}</li>
          </ul>
        </div>
      )}
    </PanelContainer>
  );
}
