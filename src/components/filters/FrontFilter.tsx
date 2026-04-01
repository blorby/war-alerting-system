"use client";

import { useAppStore } from "@/lib/store";

const FRONTS = [
  { value: "all", label: "All" },
  { value: "iran", label: "Iran" },
  { value: "gaza", label: "Gaza" },
  { value: "lebanon", label: "Lebanon" },
  { value: "west_bank", label: "West Bank" },
  { value: "internal", label: "Internal" },
] as const;

export default function FrontFilter() {
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
          {front.label}
        </button>
      ))}
    </div>
  );
}
