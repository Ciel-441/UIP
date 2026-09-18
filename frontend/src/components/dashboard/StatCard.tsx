'use client';

import React from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import GlassCard from '@/components/ui/GlassCard';
import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  gradient: string;
  iconColor: string;
  delay?: number;
  slideFrom?: 'bottom' | 'left' | 'right' | 'top' | 'none';
  isMobile?: boolean;
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 55, damping: 18 });
  const display = useTransform(spring, (v) => Math.floor(v).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

export default function StatCard({
  icon,
  value,
  label,
  gradient,
  iconColor,
  delay = 0,
  slideFrom = 'bottom',
  isMobile = false,
}: StatCardProps) {
  return (
    <GlassCard
      glowColor={`${iconColor}28`}
      delay={delay}
      slideFrom={slideFrom}
      className="p-6 group"
    >
      {/* Full-card ambient gradient tint */}
      <div
        className={cn(
          'absolute inset-0 opacity-[0.05] group-hover:opacity-[0.10] transition-opacity duration-700 z-[4]',
          gradient
        )}
      />

      {/* Glowing orb behind icon - disabled on mobile */}
      {!isMobile && (
        <div
          className="absolute top-3 right-3 w-24 h-24 rounded-full blur-[50px] opacity-20 group-hover:opacity-50 transition-opacity duration-700 pointer-events-none z-[4]"
          style={{ backgroundColor: iconColor }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em]">
            {label}
          </p>
          <p className="text-4xl font-bold text-white tabular-nums drop-shadow-sm">
            {isMobile ? value.toLocaleString() : <AnimatedNumber value={value} />}
          </p>
        </div>

        <motion.div
          whileHover={isMobile ? undefined : { scale: 1.18, rotate: 6 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14 }}
          className="flex items-center justify-center w-12 h-12 rounded-xl"
          style={{
            backgroundColor: `${iconColor}1a`,
            color: iconColor,
            boxShadow: `0 0 0 1px ${iconColor}18, 0 0 20px ${iconColor}15`,
          }}
        >
          {icon}
        </motion.div>
      </div>

      {/* Bottom accent glow line - disabled on mobile */}
      {!isMobile && (
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-[2px] z-[6]"
          initial={{ scaleX: 0, opacity: 0 }}
          whileHover={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          style={{
            background: `linear-gradient(90deg, transparent, ${iconColor}, transparent)`,
            boxShadow: `0 0 16px ${iconColor}50`,
            transformOrigin: 'center',
            transform: 'scaleX(0)',
          }}
        />
      )}
    </GlassCard>
  );
}
