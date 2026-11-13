'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-white/[0.04]',
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#12121a]/95 lg:bg-slate-900/40 backdrop-blur-none lg:backdrop-blur-2xl border border-white/[0.08] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-20" />
        </div>
        <Skeleton className="h-12 w-12 rounded-xl" />
      </div>
    </motion.div>
  );
}

export function ChartSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#12121a]/95 lg:bg-slate-900/40 backdrop-blur-none lg:backdrop-blur-2xl border border-white/[0.08] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.35)]"
    >
      <div className="space-y-3 mb-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="h-[280px] w-full rounded-xl" />
      <div className="flex justify-center gap-6 mt-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
    </motion.div>
  );
}

export function ActivitySkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#12121a]/95 lg:bg-slate-900/40 backdrop-blur-none lg:backdrop-blur-2xl border border-white/[0.08] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.35)]"
    >
      <div className="space-y-3 mb-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-52" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-full max-w-[280px]" />
              <Skeleton className="h-2 w-full max-w-[180px]" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function UsersPanelSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#12121a]/95 lg:bg-slate-900/40 backdrop-blur-none lg:backdrop-blur-2xl border border-white/[0.08] p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.35)]"
    >
      <Skeleton className="h-5 w-32 mb-6" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-2 w-36" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default Skeleton;
