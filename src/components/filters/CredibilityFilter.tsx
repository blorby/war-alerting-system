'use client';

import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n/useT';
import CredibilityInfoTooltip from '@/components/ui/CredibilityInfoTooltip';

const OPTIONS = [
  { value: 0, key: 'credibility.filterAll' },
  { value: 45, key: 'credibility.filterMedium' },
  { value: 70, key: 'credibility.filterHigh' },
] as const;

export default function CredibilityFilter() {
  const t = useT();
  const minCredibility = useAppStore((s) => s.minCredibility);
  const setMinCredibility = useAppStore((s) => s.setMinCredibility);

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setMinCredibility(opt.value)}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            minCredibility === opt.value
              ? 'bg-info/20 text-info'
              : 'text-muted hover:text-foreground'
          }`}
        >
          {t(opt.key)}
        </button>
      ))}
      <CredibilityInfoTooltip />
    </div>
  );
}
