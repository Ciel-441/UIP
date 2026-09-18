'use client';

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { getEntityColor } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';

interface EntityDistributionData {
  name: string;
  value: number;
}

interface EntityDistributionProps {
  data: EntityDistributionData[];
  delay?: number;
  slideFrom?: 'bottom' | 'left' | 'right' | 'top' | 'none';
  isMobile?: boolean;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  const color = getEntityColor(name);

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-xl px-4 py-3 shadow-2xl shadow-black/50">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} />
        <span className="text-sm text-white font-medium">{name}</span>
      </div>
      <p className="text-xs text-slate-400 mt-1 ml-[18px]">{value} entities</p>
    </div>
  );
}

export default function EntityDistribution({ data, delay = 0, slideFrom = 'bottom', isMobile = false }: EntityDistributionProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <GlassCard glowColor="rgba(255, 121, 198, 0.12)" delay={delay} slideFrom={slideFrom} className="p-6">
      {/* Ambient light reflection - disabled on mobile */}
      {!isMobile && (
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-accent/15 rounded-full blur-[50px] pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-700 z-[4]" />
      )}

      <div className="mb-6 relative z-10">
        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-secondary">Entity Distribution</h3>
        <p className="text-sm text-slate-400 mt-1">Breakdown by entity type</p>
      </div>

      {isMobile ? (
        <div className="space-y-4 my-6 relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Total Entities</span>
            <span className="text-lg font-bold text-white">{total}</span>
          </div>
          <div className="space-y-3.5">
            {data.map((entry) => {
              const color = getEntityColor(entry.name);
              const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
              return (
                <div key={entry.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{entry.name}</span>
                    <span className="text-slate-400 font-mono">{entry.value} ({percentage}%)</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="h-[240px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={true}
                  animationDuration={1200}
                  animationEasing="ease-out"
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getEntityColor(entry.name)}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <p className="text-3xl font-bold text-white drop-shadow-lg">{total}</p>
              <p className="text-xs text-slate-400">Total</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 relative z-10">
            {data.map((entry) => {
              const color = getEntityColor(entry.name);
              const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0';
              return (
                <div key={entry.name} className="flex items-center gap-2.5 group/legend cursor-default">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all duration-200 group-hover/legend:scale-125"
                    style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}40` }}
                  />
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className="text-xs text-slate-300 truncate">{entry.name}</span>
                    <span className="text-xs text-slate-500 ml-2 font-mono">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </GlassCard>
  );
}
