'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  delay?: number;
  noHoverGlow?: boolean;
  slideFrom?: 'bottom' | 'left' | 'right' | 'top' | 'none';
  onClick?: () => void;
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export default function GlassCard({
  children,
  className,
  glowColor = 'rgba(255, 121, 198, 0.15)',
  delay = 0,
  noHoverGlow = false,
  slideFrom = 'bottom',
  onClick,
  onMouseEnter,
  onMouseLeave,
}: GlassCardProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(window.innerWidth < 1024 || isTouch);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  type SlideVariant = { opacity: number; y?: number; x?: number; scale?: number };

  const slideVariants: Record<string, SlideVariant> = {
    bottom: { opacity: 0, y: isMobile ? 30 : 60, scale: isMobile ? 0.98 : 0.96 },
    left:   { opacity: 0, x: isMobile ? -40 : -80, scale: isMobile ? 0.98 : 0.96 },
    right:  { opacity: 0, x: isMobile ? 40 : 80, scale: isMobile ? 0.98 : 0.96 },
    top:    { opacity: 0, y: isMobile ? -30 : -60, scale: isMobile ? 0.98 : 0.96 },
    none:   { opacity: 0 },
  };

  const slideAnimate: Record<string, SlideVariant> = {
    bottom: { opacity: 1, y: 0, scale: 1 },
    left:   { opacity: 1, x: 0, scale: 1 },
    right:  { opacity: 1, x: 0, scale: 1 },
    top:    { opacity: 1, y: 0, scale: 1 },
    none:   { opacity: 1 },
  };

  return (
    <motion.div
      onClick={onClick}
      initial={slideVariants[slideFrom]}
      animate={slideAnimate[slideFrom]}
      transition={
        isMobile
          ? { duration: 0.28, ease: 'easeOut', delay }
          : {
              type: 'spring',
              stiffness: 180,
              damping: 22,
              delay,
              opacity: { duration: 0.4, delay },
            }
      }
      onMouseEnter={(e) => {
        if (!isMobile) {
          setIsHovering(true);
          if (onMouseEnter) onMouseEnter(e as any);
        }
      }}
      onMouseLeave={(e) => {
        if (!isMobile) {
          setIsHovering(false);
          if (onMouseLeave) onMouseLeave(e as any);
        }
      }}
      className={cn(
        'relative overflow-hidden rounded-2xl border transition-[border-color,box-shadow] duration-500',
        isMobile
          ? 'bg-[#12121a]/95 border-white/[0.06] shadow-[0_4px_16px_rgba(0,0,0,0.3)]'
          : 'bg-slate-900/40 backdrop-blur-2xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.35)] hover:border-white/[0.15] hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)]',
        className
      )}
    >
      {/* Noise texture for frosted glass - disabled on mobile to avoid blend-mode GPU lag */}
      {!isMobile && (
        <div
          className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-overlay z-[1]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '128px 128px',
          }}
        />
      )}

      {/* Glow border reflection on hover - disabled on mobile */}
      {!isMobile && (
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none z-[3]"
          animate={{ opacity: isHovering ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
            mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            padding: '1px',
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-[5]">
        {children}
      </div>
    </motion.div>
  );
}
