"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/useT";

interface SidebarProps {
  children: React.ReactNode;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ children, mobileOpen = false, onMobileClose }: SidebarProps) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:hidden ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onMobileClose}
      />

      <aside
        className={`
          flex shrink-0 flex-col border-r border-border bg-surface
          fixed top-0 bottom-0 left-0 z-50 w-[85vw] max-w-80 transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"}
          md:relative md:z-auto md:translate-x-0 md:pointer-events-auto md:w-80 md:max-w-none md:transition-[width]
          ${collapsed ? "md:w-0 md:overflow-hidden" : "md:w-80"}
        `}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2 md:hidden">
          <span className="text-xs font-bold tracking-wide">{t("sidebar.menu")}</span>
          <button
            onClick={onMobileClose}
            className="p-1 text-muted hover:text-foreground"
            aria-label={t("sidebar.closeMenu")}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-8 top-3 z-10 h-6 w-6 items-center justify-center rounded-r bg-surface-elevated text-muted hover:text-foreground"
          aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
        >
          <svg
            className={`h-3 w-3 transition-transform ${collapsed ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div className="flex h-full flex-col overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}
