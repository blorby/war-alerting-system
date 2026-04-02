'use client';

import { useAppStore } from '@/lib/store';
import { useT, useLocale } from '@/lib/i18n/useT';
import PanelContainer from './PanelContainer';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function MissileCountsPanel() {
  const t = useT();
  const locale = useLocale();
  const missileCounts = useAppStore((s) => s.missileCounts);

  const icon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );

  const chartData = missileCounts
    ? missileCounts.dates.map((date, i) => ({
        date,
        missiles: missileCounts.missiles[i],
        uavs: missileCounts.uavs[i],
      }))
    : [];

  return (
    <PanelContainer title={t('panels.attackWaves')} icon={icon}>
      {!missileCounts ? (
        <p className="text-muted text-center py-4">{t('panels.noMissile')}</p>
      ) : (
        <div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#737373' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#737373' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1c1c1c',
                    border: '1px solid #262626',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#e5e5e5',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="missiles" fill="#ef4444" name={t('panels.missiles')} />
                <Bar dataKey="uavs" fill="#f97316" name={t('panels.uavs')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between text-muted mt-1">
            <span>
              <span className="text-red-400 font-medium">{missileCounts.totalMissiles}</span> {t('panels.missileWaves')},{' '}
              <span className="text-orange-400 font-medium">{missileCounts.totalUavs}</span> {t('panels.uavWaves')}
            </span>
            <span className="text-[10px]">{t('panels.since', { date: new Date(missileCounts.since).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US') })}</span>
          </div>
        </div>
      )}
    </PanelContainer>
  );
}
