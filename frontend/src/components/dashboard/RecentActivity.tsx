'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import GlassCard from '@/components/ui/GlassCard';
import {
  Plus,
  Pencil,
  Trash2,
  Link2,
  Upload,
  Search,
  Sparkles,
  GitMerge,
  Activity as ActivityIcon,
  Zap,
} from 'lucide-react';

interface RecentActivityProps {
  activities: Activity[];
  delay?: number;
  slideFrom?: 'bottom' | 'left' | 'right' | 'top' | 'none';
  isMobile?: boolean;
}

type ActionMeta = {
  icon: React.ReactNode;
  color: string;
  bg: string;
  glow: string;
  label: string;
};

function getActionMeta(action: string): ActionMeta {
  const lower = action.toLowerCase();
  if (lower.includes('merge'))
    return { icon: <GitMerge className="w-3.5 h-3.5" />, color: '#c084fc', bg: 'rgba(139,92,246,0.12)', glow: 'rgba(139,92,246,0.25)', label: 'merged' };
  if (lower.includes('create') || lower.includes('add') || lower.includes('extract'))
    return { icon: <Plus className="w-3.5 h-3.5" />, color: '#34d399', bg: 'rgba(52,211,153,0.12)', glow: 'rgba(52,211,153,0.25)', label: 'created' };
  if (lower.includes('update') || lower.includes('edit'))
    return { icon: <Pencil className="w-3.5 h-3.5" />, color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', glow: 'rgba(96,165,250,0.25)', label: 'updated' };
  if (lower.includes('delete') || lower.includes('remove'))
    return { icon: <Trash2 className="w-3.5 h-3.5" />, color: '#f87171', bg: 'rgba(248,113,113,0.12)', glow: 'rgba(248,113,113,0.25)', label: 'deleted' };
  if (lower.includes('link') || lower.includes('connect'))
    return { icon: <Link2 className="w-3.5 h-3.5" />, color: '#fb923c', bg: 'rgba(251,146,60,0.12)', glow: 'rgba(251,146,60,0.25)', label: 'linked' };
  if (lower.includes('upload'))
    return { icon: <Upload className="w-3.5 h-3.5" />, color: '#22d3ee', bg: 'rgba(34,211,238,0.12)', glow: 'rgba(34,211,238,0.25)', label: 'uploaded' };
  if (lower.includes('search') || lower.includes('query'))
    return { icon: <Search className="w-3.5 h-3.5" />, color: '#e879f9', bg: 'rgba(232,121,249,0.12)', glow: 'rgba(232,121,249,0.25)', label: 'searched' };
  if (lower.includes('ai') || lower.includes('infer'))
    return { icon: <Sparkles className="w-3.5 h-3.5" />, color: '#ff92df', bg: 'rgba(129,140,248,0.12)', glow: 'rgba(129,140,248,0.25)', label: 'AI' };
  return { icon: <Zap className="w-3.5 h-3.5" />, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', glow: 'rgba(148,163,184,0.15)', label: 'action' };
}

export default function RecentActivity({ activities, delay = 0, slideFrom = 'bottom', isMobile = false }: RecentActivityProps) {
  return (
    <GlassCard glowColor="rgba(52,211,153,0.08)" delay={delay} slideFrom={slideFrom} className="p-0 overflow-hidden">
      {/* Header */}
      <div className="relative px-6 pt-6 pb-4">
        {/* Header ambient glow - disabled on mobile */}
        {!isMobile && (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.05] via-transparent to-transparent pointer-events-none" />
        )}
        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <h3 className="text-lg font-bold text-white tracking-tight">Recent Activity</h3>
            </div>
            <p className="text-xs text-slate-500 ml-4">Latest operations across the platform</p>
          </div>
          {activities.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.06]">
              <span className="text-xs font-bold text-slate-400">{activities.length}</span>
              <span className="text-[10px] text-slate-600 uppercase tracking-wider">events</span>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Feed */}
      <div className="px-3 py-3 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <ActivityIcon className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-transparent via-white/[0.07] to-transparent pointer-events-none" />

            <div className="space-y-0.5">
              {activities.map((activity, i) => {
                const meta = getActionMeta(activity.action);
                const transition: any = isMobile
                  ? { duration: 0.15, ease: 'easeOut', delay: i * 0.012 }
                  : {
                      delay: i * 0.04,
                      type: 'spring' as const,
                      stiffness: 280,
                      damping: 26,
                    };
                return (
                  <motion.div
                    key={activity.id}
                    initial={isMobile ? false : { opacity: 0, x: -16 }}
                    animate={isMobile ? false : { opacity: 1, x: 0 }}
                    transition={transition}
                    className="group/item flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-default relative
                      hover:bg-white/[0.03] transition-colors duration-200"
                  >
                    {/* Icon */}
                    <div
                      className="relative z-10 flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-xl mt-0.5
                        transition-all duration-300 group-hover/item:scale-105"
                      style={{
                        backgroundColor: meta.bg,
                        color: meta.color,
                        boxShadow: `0 0 0 1px ${meta.color}20, inset 0 1px 0 rgba(255,255,255,0.06)`,
                      }}
                    >
                      {meta.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        {activity.user_name && (
                          <span className="text-sm font-semibold text-white">{activity.user_name}</span>
                        )}
                        {/* Action badge */}
                        <span
                          className="text-[11px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md"
                          style={{ backgroundColor: meta.bg, color: meta.color }}
                        >
                          {activity.action}
                        </span>
                        {activity.entity_type && (
                          <span className="text-xs text-slate-500 font-medium">
                            · {activity.entity_type}
                          </span>
                        )}
                      </div>
                      {activity.details && (
                        <p className="text-[11px] text-slate-600 mt-0.5 truncate leading-relaxed">
                          {activity.details}
                        </p>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1 pt-0.5">
                      <span className="text-[11px] text-slate-600 tabular-nums whitespace-nowrap group-hover/item:text-slate-400 transition-colors duration-200">
                        {formatRelativeTime(activity.created_at)}
                      </span>
                    </div>

                    {/* Hover left accent */}
                    {!isMobile && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-0 group-hover/item:h-3/4 rounded-r-full transition-all duration-300"
                        style={{ backgroundColor: meta.color }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
