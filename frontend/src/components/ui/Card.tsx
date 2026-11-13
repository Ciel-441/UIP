import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: boolean;
}

export default function Card({ children, className, hover = false, padding = true }: CardProps) {
  return (
    <div className={cn(
      'bg-[#12121a] border border-[#2a2a3e] rounded-xl',
      hover && 'hover:border-[#3a3a4e] hover:bg-[#1a1a2e] transition-all duration-200 cursor-pointer',
      padding && 'p-6',
      className
    )}>
      {children}
    </div>
  );
}
