'use client';

import { useState, ReactNode } from 'react';

interface PanelContainerProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  defaultMinimized?: boolean;
}

export default function PanelContainer({
  title,
  icon,
  children,
  actions,
  defaultMinimized = false,
}: PanelContainerProps) {
  const [minimized, setMinimized] = useState(defaultMinimized);
  const [maximized, setMaximized] = useState(false);

  return (
    <div
      className={`flex flex-col border border-border rounded bg-surface ${
        maximized ? 'fixed inset-4 z-50' : 'h-full'
      }`}
    >
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-surface-elevated shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wide">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          <button
            onClick={() => setMinimized((m) => !m)}
            className="p-1 text-muted hover:text-foreground transition-colors"
            title={minimized ? 'Expand' : 'Minimize'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {minimized ? (
                <polyline points="15 3 21 3 21 9" />
              ) : (
                <line x1="5" y1="12" x2="19" y2="12" />
              )}
            </svg>
          </button>
          <button
            onClick={() => setMaximized((m) => !m)}
            className="p-1 text-muted hover:text-foreground transition-colors"
            title={maximized ? 'Restore' : 'Maximize'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {maximized ? (
                <>
                  <polyline points="4 14 10 14 10 20" />
                  <polyline points="20 10 14 10 14 4" />
                </>
              ) : (
                <rect x="3" y="3" width="18" height="18" rx="2" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {!minimized && (
        <div className="flex-1 overflow-auto p-2 text-xs">
          {children}
        </div>
      )}
    </div>
  );
}
