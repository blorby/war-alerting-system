'use client';

import { useAppStore } from '@/lib/store';
import PanelContainer from './PanelContainer';

function PlaneIcon({ heading }: { heading: number }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="shrink-0"
      style={{ transform: `rotate(${heading}deg)` }}
    >
      <path d="M12 2L4 14h3v6h10v-6h3L12 2z" />
    </svg>
  );
}

function HeadingArrow({ heading }: { heading: number }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className="inline-block"
      style={{ transform: `rotate(${heading}deg)` }}
    >
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s === 'airborne' || s === 'active') return 'text-green-400';
  if (s === 'grounded' || s === 'landed') return 'text-muted';
  if (s === 'emergency') return 'text-critical';
  return 'text-yellow-400';
}

export default function FlightTrackerPanel() {
  const flights = useAppStore((s) => s.flights);

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
    </svg>
  );

  return (
    <PanelContainer title="Flight Tracker" icon={icon}>
      {flights.length === 0 ? (
        <p className="text-muted text-center py-4">No flights tracked</p>
      ) : (
        <table className="w-full text-left">
          <thead>
            <tr className="text-muted border-b border-border">
              <th className="pb-1 font-medium">Callsign</th>
              <th className="pb-1 font-medium">Type</th>
              <th className="pb-1 font-medium">Alt</th>
              <th className="pb-1 font-medium">Spd</th>
              <th className="pb-1 font-medium">Hdg</th>
              <th className="pb-1 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {flights.map((f) => (
              <tr key={f.id} className="border-b border-border/50 last:border-0">
                <td className="py-0.5">
                  <div className="flex items-center gap-1">
                    <PlaneIcon heading={f.heading} />
                    <span className="font-mono text-foreground">{f.callsign}</span>
                    {f.isMilitary && (
                      <span className="px-1 py-0 rounded bg-red-500/20 text-red-400 text-[9px] font-bold">
                        MIL
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-0.5 text-muted">{f.type}</td>
                <td className="py-0.5 text-muted font-mono">
                  {f.altitude >= 1000 ? `${(f.altitude / 1000).toFixed(1)}k` : f.altitude}
                </td>
                <td className="py-0.5 text-muted font-mono">{f.speed}kt</td>
                <td className="py-0.5 text-muted">
                  {f.heading}° <HeadingArrow heading={f.heading} />
                </td>
                <td className={`py-0.5 font-medium ${statusColor(f.status)}`}>
                  {f.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PanelContainer>
  );
}
