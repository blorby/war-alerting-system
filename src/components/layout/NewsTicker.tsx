"use client";

interface TickerItem {
  id: string;
  text: string;
  type: "news" | "alert" | "thermal" | "social";
  timestamp: Date;
}

interface NewsTickerProps {
  items?: TickerItem[];
}

const typeColors: Record<string, string> = {
  news: "bg-info",
  alert: "bg-critical",
  thermal: "bg-moderate",
  social: "bg-purple-500",
};

export default function NewsTicker({ items = [] }: NewsTickerProps) {
  if (items.length === 0) {
    return (
      <div className="flex h-7 shrink-0 items-center border-t border-border bg-surface px-4">
        <span className="text-xs text-muted">
          Waiting for events...
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-7 shrink-0 items-center overflow-hidden border-t border-border bg-surface">
      <div className="animate-marquee flex whitespace-nowrap">
        {items.map((item) => (
          <span key={item.id} className="mx-6 flex items-center gap-2 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${typeColors[item.type] ?? "bg-muted"}`}
            />
            <span className="text-foreground">{item.text}</span>
            <span className="text-muted">
              {formatTimeAgo(item.timestamp)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
