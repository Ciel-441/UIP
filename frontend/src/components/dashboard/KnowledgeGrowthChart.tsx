'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import GlassCard from '@/components/ui/GlassCard';

interface GrowthDataPoint {
  date: string;
  entities: number;
  relationships: number;
}

interface KnowledgeGrowthChartProps {
  data: GrowthDataPoint[];
  delay?: number;
  slideFrom?: 'bottom' | 'left' | 'right' | 'top' | 'none';
  isMobile?: boolean;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-slate-900/90 border border-white/10 rounded-xl px-4 py-3 shadow-2xl shadow-black/50">
      <p className="text-xs text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color, boxShadow: `0 0 8px ${entry.color}60` }}
          />
          <span className="text-slate-300 capitalize">{entry.name}:</span>
          <span className="text-white font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function KnowledgeGrowthChart({ data, delay = 0, slideFrom = 'bottom', isMobile = false }: KnowledgeGrowthChartProps) {
  return (
    <GlassCard glowColor="rgba(255, 121, 198, 0.12)" delay={delay} slideFrom={slideFrom} className="p-6">
      {/* Ambient light reflections - disabled on mobile */}
      {!isMobile && (
        <>
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-accent/15 rounded-full blur-[60px] pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-700 z-[4]" />
          <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-accent-secondary/10 rounded-full blur-[50px] pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity duration-700 z-[4]" />
        </>
      )}

      <div className="mb-6 relative z-10">
        <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-secondary">Knowledge Growth</h3>
        <p className="text-sm text-slate-400 mt-1">Entity and relationship growth over time</p>
      </div>

      {isMobile ? (
        <div className="space-y-4 my-6 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-xs text-slate-400">Latest Entities</span>
              <p className="text-2xl font-bold text-accent mt-1">{data[data.length - 1]?.entities ?? 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-xs text-slate-400">Latest Relationships</span>
              <p className="text-2xl font-bold text-accent-secondary mt-1">{data[data.length - 1]?.relationships ?? 0}</p>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.04] overflow-hidden">
            <div className="grid grid-cols-3 bg-white/[0.02] p-2.5 text-xs text-slate-400 font-medium text-center">
              <div>Date</div>
              <div>Entities</div>
              <div>Relations</div>
            </div>
            <div className="divide-y divide-white/[0.04] text-center">
              {data.slice(-4).reverse().map((row, idx) => (
                <div key={idx} className="grid grid-cols-3 p-2.5 text-xs text-slate-300">
                  <div className="font-medium">{row.date}</div>
                  <div className="font-mono text-accent-hover">{row.entities}</div>
                  <div className="font-mono text-accent-secondary">{row.relationships}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="h-[320px] relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradEntPremV2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff92df" stopOpacity={0.45} />
                    <stop offset="50%" stopColor="#ff79c6" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#ff79c6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRelPremV2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity={0.45} />
                    <stop offset="50%" stopColor="#d68eff" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#d68eff" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dx={-5} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="entities"
                  name="Entities"
                  stroke="#ff92df"
                  strokeWidth={2.5}
                  fill="url(#gradEntPremV2)"
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: '#ff92df',
                    stroke: '#0f172a',
                    strokeWidth: 3,
                    style: { filter: 'drop-shadow(0 0 6px rgba(255, 121, 198, 0.6))' },
                  }}
                  isAnimationActive={true}
                  animationDuration={1500}
                  animationEasing="ease-out"
                />
                <Area
                  type="monotone"
                  dataKey="relationships"
                  name="Relationships"
                  stroke="#c084fc"
                  strokeWidth={2.5}
                  fill="url(#gradRelPremV2)"
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: '#c084fc',
                    stroke: '#0f172a',
                    strokeWidth: 3,
                    style: { filter: 'drop-shadow(0 0 6px rgba(214, 142, 255, 0.6))' },
                  }}
                  isAnimationActive={true}
                  animationDuration={1500}
                  animationEasing="ease-out"
                  animationBegin={300}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 mt-4 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent shadow-[0_0_8px_rgba(255,121,198,0.5)]" />
              <span className="text-xs text-slate-300 font-medium">Entities</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent-secondary shadow-[0_0_8px_rgba(214,142,255,0.5)]" />
              <span className="text-xs text-slate-300 font-medium">Relationships</span>
            </div>
          </div>
        </>
      )}
    </GlassCard>
  );
}
