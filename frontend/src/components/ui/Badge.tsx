import React from 'react';
import { cn } from '@/lib/utils';
import { getEntityColor, getEntityBgColor } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'entity' | 'status';
  entityType?: string;
  status?: 'uploaded' | 'processing' | 'extracted' | 'confirmed' | 'error';
  className?: string;
  style?: React.CSSProperties;
}

export default function Badge({ children, variant = 'default', entityType, status, className, style }: BadgeProps) {
  const getStyles = () => {
    if (variant === 'entity' && entityType) {
      return {
        backgroundColor: getEntityBgColor(entityType),
        color: getEntityColor(entityType),
        borderColor: `${getEntityColor(entityType)}33`,
      };
    }
    if (variant === 'status' && status) {
      const statusStyles: Record<string, { bg: string; text: string }> = {
        uploaded: { bg: 'rgba(107, 107, 123, 0.15)', text: '#6b6b7b' },
        processing: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
        extracted: { bg: 'rgba(255, 121, 198, 0.15)', text: '#ff79c6' },
        confirmed: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
        error: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
      };
      const s = statusStyles[status] || statusStyles.uploaded;
      return { backgroundColor: s.bg, color: s.text };
    }
    return {};
  };

  const combinedStyle = variant !== 'default' ? { ...getStyles(), ...style } : style;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variant === 'default' && 'bg-[#1a1a2e] text-[#a0a0b0] border-[#2a2a3e]',
        className
      )}
      style={combinedStyle}
    >
      {children}
    </span>
  );
}
