'use client';

import { useState, useRef, useEffect } from 'react';
import { useT } from '@/lib/i18n/useT';

export default function CredibilityInfoTooltip() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-border text-[9px] font-bold text-muted hover:text-foreground hover:border-foreground/50 transition-colors"
        aria-label={t('credibility.infoTitle')}
      >
        i
      </button>

      {open && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-64 rounded-lg border border-border bg-surface-elevated p-3 shadow-lg">
          <div className="text-xs font-bold mb-1.5">{t('credibility.infoTitle')}</div>
          <div className="text-[10px] text-muted leading-relaxed whitespace-pre-line">
            {t('credibility.infoBody')}
          </div>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-b border-r border-border bg-surface-elevated" />
        </div>
      )}
    </div>
  );
}
