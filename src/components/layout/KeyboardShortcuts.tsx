'use client';

import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Space', action: 'Play / Pause' },
  { key: 'Left Arrow', action: 'Step back' },
  { key: 'Right Arrow', action: 'Step forward' },
  { key: '+', action: 'Speed up' },
  { key: '-', action: 'Speed down' },
  { key: 'L', action: 'Return to live' },
  { key: 'S', action: 'Toggle sound' },
  { key: 'M', action: 'Toggle sidebar' },
  { key: '1-5', action: 'Focus area (Israel/Iran/Gulf/Red Sea/Region)' },
  { key: '?', action: 'Show/hide shortcuts' },
  { key: 'Esc', action: 'Close modal' },
];

export default function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
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
          <h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between text-xs">
              <span className="text-foreground/80">{s.action}</span>
              <kbd className="px-1.5 py-0.5 bg-surface-elevated border border-border rounded text-[10px] text-muted font-mono">{s.key}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
