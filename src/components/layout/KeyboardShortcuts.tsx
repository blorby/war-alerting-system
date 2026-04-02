'use client';

import { useEffect } from 'react';
import { useT } from '@/lib/i18n/useT';

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_KEYS = [
  { key: 'Space', actionKey: 'shortcuts.playPause' },
  { key: 'Left Arrow', actionKey: 'shortcuts.stepBack' },
  { key: 'Right Arrow', actionKey: 'shortcuts.stepForward' },
  { key: '+', actionKey: 'shortcuts.speedUp' },
  { key: '-', actionKey: 'shortcuts.speedDown' },
  { key: 'L', actionKey: 'shortcuts.returnLive' },
  { key: 'S', actionKey: 'shortcuts.toggleSound' },
  { key: 'M', actionKey: 'shortcuts.toggleSidebar' },
  { key: '1-5', actionKey: 'shortcuts.focusArea' },
  { key: '?', actionKey: 'shortcuts.showHide' },
  { key: 'Esc', actionKey: 'shortcuts.closeModal' },
];

export default function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-surface border border-border rounded-lg p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">{t('shortcuts.title')}</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="space-y-1.5">
          {SHORTCUT_KEYS.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-xs">
              <span className="text-foreground/80">{t(s.actionKey)}</span>
              <kbd className="px-1.5 py-0.5 bg-surface-elevated border border-border rounded text-[10px] text-muted font-mono">{s.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
