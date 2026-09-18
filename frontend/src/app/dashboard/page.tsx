'use client';

import ClientOnly from '@/components/ClientOnly';

import React from 'react';
import { motion } from 'framer-motion';
import AppShell from '@/components/layout/AppShell';
import StatCard from '@/components/dashboard/StatCard';
import KnowledgeGrowthChart from '@/components/dashboard/KnowledgeGrowthChart';
import EntityDistribution from '@/components/dashboard/EntityDistribution';
import RecentActivity from '@/components/dashboard/RecentActivity';
import UsersPanel from '@/components/dashboard/UsersPanel';
import TextReveal from '@/components/ui/TextReveal';
import { useApi } from '@/hooks/useApi';
import { dashboardApi } from '@/lib/api';
import { DashboardStats, Activity } from '@/types';
import { StatCardSkeleton, ChartSkeleton, ActivitySkeleton, UsersPanelSkeleton } from '@/components/ui/Skeleton';
import {
  Boxes,
  GitFork,
  FileText,
  Activity as ActivityIcon,
} from 'lucide-react';

// Staggered container for orchestrated sequence
const pageVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export default function DashboardPage() {
  const [isMobile, setIsMobile] = React.useState(true); // Default true to prevent hydration flash of heavy mesh on mobile

  React.useEffect(() => {
    const checkMobile = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(window.innerWidth < 1024 || isTouch);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data: stats, loading: statsLoading, refetch: refetchStats } = useApi<DashboardStats>(
    () => dashboardApi.stats(),
    []
  );

  const { data: activities, loading: activitiesLoading, refetch: refetchActivities } = useApi<Activity[]>(
    () => dashboardApi.recentActivity(20),
    []
  );

  const { data: growth, loading: growthLoading, refetch: refetchGrowth } = useApi<any[]>(
    () => dashboardApi.growth(),
    []
  );

  React.useEffect(() => {
    const pollInterval = isMobile ? 60000 : 5000;
    const interval = setInterval(() => {
      refetchStats();
      refetchActivities();
      refetchGrowth();
    }, pollInterval);
    return () => clearInterval(interval);
  }, [refetchStats, refetchActivities, refetchGrowth, isMobile]);

  const isLoading = statsLoading || activitiesLoading || growthLoading;

  const entityDistribution = React.useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Plant', value: 0 },
      { name: 'Animal', value: 0 },
      { name: 'Disease', value: 0 },
      { name: 'Chemical', value: 0 },
      { name: 'Climate', value: 0 },
      { name: 'Soil', value: 0 },
    ];
  }, [stats]);

  return (
    <ClientOnly>
    <AppShell>
      {/* Full-page ambient mesh - Completely unmounted on mobile */}
      {!isMobile && (
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <motion.div
            className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent/[0.04] rounded-full blur-[130px]"
            animate={{ scale: [1, 1.15, 1], opacity: [0.04, 0.07, 0.04] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent-secondary/[0.04] rounded-full blur-[110px]"
            animate={{ scale: [1, 1.2, 1], opacity: [0.04, 0.08, 0.04] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-500/[0.025] rounded-full blur-[150px]"
            animate={{ scale: [1, 1.1, 1], opacity: [0.025, 0.05, 0.025] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          />
        </div>
      )}

      <motion.div
        className="space-y-8 relative"
        variants={pageVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Page Header */}
        <div>
          <h1 className="text-4xl font-black tracking-tight">
            <TextReveal
              text="Dashboard"
              className="text-white"
              delay={0.2}
              wordDelay={0.15}
            />
          </h1>
          <motion.p
            className="text-sm text-slate-400 mt-2"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.45, type: 'spring', stiffness: 180, damping: 22 }}
          >
            Overview of your knowledge intelligence platform
          </motion.p>
        </div>

        {isLoading ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2"><ChartSkeleton /></div>
              <div><ChartSkeleton /></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2"><ActivitySkeleton /></div>
              <div><UsersPanelSkeleton /></div>
            </div>
          </>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                icon={<Boxes className="w-6 h-6" />}
                value={stats?.total_entities ?? 0}
                label="Total Entities"
                gradient="bg-gradient-to-br from-[#ff79c6] to-[#d68eff]"
                iconColor="#ff79c6"
                delay={0.1}
                slideFrom="left"
                isMobile={isMobile}
              />
              <StatCard
                icon={<GitFork className="w-6 h-6" />}
                value={stats?.total_relationships ?? 0}
                label="Relationships"
                gradient="bg-gradient-to-br from-[#ff8feb] to-[#ff79c6]"
                iconColor="#ff8feb"
                delay={0.18}
                slideFrom="left"
                isMobile={isMobile}
              />
              <StatCard
                icon={<FileText className="w-6 h-6" />}
                value={stats?.total_documents ?? 0}
                label="Documents"
                gradient="bg-gradient-to-br from-[#ff79c6] to-[#ff92df]"
                iconColor="#ff79c6"
                delay={0.26}
                slideFrom="right"
                isMobile={isMobile}
              />
              <StatCard
                icon={<ActivityIcon className="w-6 h-6" />}
                value={stats?.recent_activity_count ?? 0}
                label="Recent Activities"
                gradient="bg-gradient-to-br from-[#ff8feb] to-[#ff79c6]"
                iconColor="#ff8feb"
                delay={0.34}
                slideFrom="right"
                isMobile={isMobile}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <KnowledgeGrowthChart data={growth ?? []} delay={0.42} slideFrom="bottom" isMobile={isMobile} />
              </div>
              <div>
                <EntityDistribution
                  data={
                    (stats as any)?.entity_distribution
                      ? (stats as any).entity_distribution
                      : entityDistribution
                  }
                  delay={0.5}
                  slideFrom="right"
                  isMobile={isMobile}
                />
              </div>
            </div>

            {/* Activity & Users */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <RecentActivity activities={activities ?? []} delay={0.56} slideFrom="left" isMobile={isMobile} />
              </div>
              <div>
                <UsersPanel />
              </div>
            </div>
          </>
        )}
      </motion.div>
    </AppShell>
    </ClientOnly>
  );
}
