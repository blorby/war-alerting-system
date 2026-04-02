"use client";

import { useAppStore } from "@/lib/store";
import { useT } from "@/lib/i18n/useT";

const FRONTS = [
  { value: "all", key: "filters.all" },
  { value: "iran", key: "filters.front.iran" },
  { value: "gaza", key: "filters.front.gaza" },
  { value: "lebanon", key: "filters.front.lebanon" },
  { value: "west_bank", key: "filters.front.west_bank" },
  { value: "internal", key: "filters.front.internal" },
] as const;

export default function FrontFilter() {
  const t = useT();
  const activeFront = useAppStore((s) => s.activeFront);
  const setFront = useAppStore((s) => s.setFront);

  return (
    <div className="flex gap-1 px-3 py-2 border-b border-border">
      {FRONTS.map((front) => (
        <button
          key={front.value}
          onClick={() => setFront(front.value)}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            activeFront === front.value
              ? "bg-info/20 text-info"
              : "text-muted hover:text-foreground"
          }`}
        >
          {t(front.key)}
        </button>
      ))}
    </div>
  );
}
