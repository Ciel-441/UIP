'use client';

import ClientOnly from '@/components/ClientOnly';

import React from 'react';
import AppShell from '@/components/layout/AppShell';
import { cn } from '@/lib/utils';
import { useApi } from '@/hooks/useApi';
import { analyticsApi } from '@/lib/api';
import { EntityType } from '@/types';
import { getEntityColor } from '@/lib/utils';
import Spinner from '@/components/ui/Spinner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Network,
  FileText,
  Crown,
} from 'lucide-react';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg px-4 py-3 shadow-xl shadow-black/40">
      <p className="text-xs text-[#6b6b7b] mb-2 font-medium">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[#a0a0b0]">{entry.name}:</span>
          <span className="text-white font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: entityGrowth, loading: growthLoading } = useApi<any[]>(
    () => analyticsApi.entityGrowth(),
    []
  );

  const { data: mostConnected, loading: connectedLoading } = useApi<any[]>(
    () => analyticsApi.mostConnected(10),
    []
  );

  const { data: mostReferenced, loading: referencedLoading } = useApi<any[]>(
    () => analyticsApi.mostReferenced(10),
    []
  );

  const isLoading = growthLoading || connectedLoading || referencedLoading;

  const entityTypeKeys: EntityType[] = ['Plant', 'Animal', 'Disease', 'Chemical', 'Climate', 'Soil'];

  return (
    <ClientOnly>
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-sm text-[#6b6b7b] mt-1">Deep insights into your knowledge graph</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <Spinner size="lg" />
              <p className="text-sm text-[#6b6b7b] mt-4">Loading analytics...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Entity Growth Stacked Bar Chart */}
            <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#ff79c6]/15 text-[#ff79c6]">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Entity Growth</h3>
                  <p className="text-sm text-[#6b6b7b]">Stacked growth by entity type over time</p>
                </div>
              </div>

              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={entityGrowth ?? []} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" vertical={false} />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b6b7b', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b6b7b', fontSize: 12 }}
                      dx={-5}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ paddingTop: '16px' }}
                      formatter={(value: string) => (
                        <span className="text-xs text-[#a0a0b0]">{value}</span>
                      )}
                    />
                    {entityTypeKeys.map((type) => (
                      <Bar
                        key={type}
                        dataKey={type}
                        name={type}
                        stackId="entities"
                        fill={getEntityColor(type)}
                        radius={[0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Most Connected Entities */}
              <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#d68eff]/15 text-[#d68eff]">
                    <Network className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Most Connected</h3>
                    <p className="text-sm text-[#6b6b7b]">Top 10 entities by connections</p>
                  </div>
                </div>

                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#2a2a3e]">
                        <th className="text-left text-xs font-medium text-[#6b6b7b] uppercase tracking-wider pb-3 pr-4">#</th>
                        <th className="text-left text-xs font-medium text-[#6b6b7b] uppercase tracking-wider pb-3 pr-4">Entity</th>
                        <th className="text-left text-xs font-medium text-[#6b6b7b] uppercase tracking-wider pb-3 pr-4">Type</th>
                        <th className="text-right text-xs font-medium text-[#6b6b7b] uppercase tracking-wider pb-3">Connections</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(mostConnected ?? []).map((entity: any, index: number) => (
                        <tr
                          key={entity.id || index}
                          className="border-b border-[#2a2a3e]/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <div className={cn(
                              'flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold',
                              index === 0 ? 'bg-[#f59e0b]/15 text-[#f59e0b]' :
                              index === 1 ? 'bg-[#a0a0b0]/15 text-[#a0a0b0]' :
                              index === 2 ? 'bg-[#d97706]/15 text-[#d97706]' :
                              'bg-[#1a1a2e] text-[#6b6b7b]'
                            )}>
                              {index < 3 ? <Crown className="w-3 h-3" /> : index + 1}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-white font-medium">{entity.name}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
                              style={{
                                backgroundColor: `${getEntityColor(entity.type)}15`,
                                color: getEntityColor(entity.type),
                                borderColor: `${getEntityColor(entity.type)}33`,
                              }}
                            >
                              {entity.type}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-sm text-[#a0a0b0] font-mono">{entity.connection_count ?? entity.connections ?? 0}</span>
                          </td>
                        </tr>
                      ))}
                      {(!mostConnected || mostConnected.length === 0) && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-[#6b6b7b]">
                            No data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Most Referenced Documents */}
              <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#06b6d4]/15 text-[#06b6d4]">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Most Referenced</h3>
                    <p className="text-sm text-[#6b6b7b]">Top 10 documents by references</p>
                  </div>
                </div>

                <div className="overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#2a2a3e]">
                        <th className="text-left text-xs font-medium text-[#6b6b7b] uppercase tracking-wider pb-3 pr-4">#</th>
                        <th className="text-left text-xs font-medium text-[#6b6b7b] uppercase tracking-wider pb-3 pr-4">Document</th>
                        <th className="text-left text-xs font-medium text-[#6b6b7b] uppercase tracking-wider pb-3 pr-4">Status</th>
                        <th className="text-right text-xs font-medium text-[#6b6b7b] uppercase tracking-wider pb-3">References</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(mostReferenced ?? []).map((doc: any, index: number) => (
                        <tr
                          key={doc.id || index}
                          className="border-b border-[#2a2a3e]/50 last:border-0 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <div className={cn(
                              'flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold',
                              index === 0 ? 'bg-[#f59e0b]/15 text-[#f59e0b]' :
                              index === 1 ? 'bg-[#a0a0b0]/15 text-[#a0a0b0]' :
                              index === 2 ? 'bg-[#d97706]/15 text-[#d97706]' :
                              'bg-[#1a1a2e] text-[#6b6b7b]'
                            )}>
                              {index < 3 ? <Crown className="w-3 h-3" /> : index + 1}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-white font-medium truncate block max-w-[200px]">
                              {doc.original_name || doc.filename || doc.name}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                              {doc.status || 'confirmed'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="text-sm text-[#a0a0b0] font-mono">{doc.reference_count ?? doc.entity_count ?? 0}</span>
                          </td>
                        </tr>
                      ))}
                      {(!mostReferenced || mostReferenced.length === 0) && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-[#6b6b7b]">
                            No data available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
    </ClientOnly>
  );
}

