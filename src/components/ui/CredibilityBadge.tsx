'use client';

import { getCredibilityColor } from '@/lib/credibility';

interface CredibilityBadgeProps {
  score: number;
  showLabel?: boolean;
  label?: string;
}

export default function CredibilityBadge({ score, showLabel, label }: CredibilityBadgeProps) {
  const { text, bg } = getCredibilityColor(score);

  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold ${bg} ${text}`}>
      {score}%
      {showLabel && label && <span className="font-medium">{label}</span>}
    </span>
  );
}
