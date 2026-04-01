'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const RANGES = ['1h', '6h', '24h', '7d', '30d'] as const;

export default function ThreatHistoryChart() {
  const [range, setRange] = useState<string>('24h');
  const history = useAppStore((s) => s.threatHistory);
  const fetchThreatHistory = useAppStore((s) => s.fetchThreatHistory);

  useEffect(() => {
    fetchThreatHistory(range);
  }, [range, fetchThreatHistory]);

  const data = [...history].reverse().map((h) => ({
    time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    score: h.score,
  }));

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">History</span>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-1.5 py-0.5 text-[10px] rounded ${range === r ? 'bg-info/20 text-info' : 'text-muted hover:text-foreground'}`}
            >{r}</button>
          ))}
        </div>
      </div>
      <div className="h-16">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis dataKey="time" hide />
              <YAxis domain={[0, 10]} hide />
              <Tooltip contentStyle={{ background: '#171717', border: '1px solid #262626', fontSize: 11 }} labelStyle={{ color: '#737373' }} />
              <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-[10px] text-muted">Not enough data</div>
        )}
      </div>
    </div>
  );
}
