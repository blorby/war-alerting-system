"use client";

import { useAppStore } from "@/lib/store";
import { EVENT_TYPES } from "@/lib/constants";
import { useT } from "@/lib/i18n/useT";

export default function TypeFilter() {
  const t = useT();
  const activeType = useAppStore((s) => s.activeType);
  const setType = useAppStore((s) => s.setType);

  return (
    <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border">
      <button
        onClick={() => setType("all")}
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
          activeType === "all"
            ? "bg-info/20 text-info"
            : "text-muted hover:text-foreground"
        }`}
      >
        {t("filters.all")}
      </button>
      {EVENT_TYPES.map((et) => (
        <button
          key={et.value}
          onClick={() => setType(et.value)}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
            activeType === et.value
              ? "bg-info/20 text-info"
              : "text-muted hover:text-foreground"
          }`}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: et.color }}
          />
          {et.label}
        </button>
      ))}
    </div>
  );
}
