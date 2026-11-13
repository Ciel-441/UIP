'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-300 ease-out hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0a0f] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0';

  const variants = {
    primary: 'bg-[#ff79c6] hover:bg-[#ff92df] text-white focus:ring-[#ff79c6] shadow-lg shadow-[#ff79c6]/20',
    secondary: 'bg-[#1a1a2e] hover:bg-[#2a2a3e] text-[#a0a0b0] border border-[#2a2a3e] focus:ring-[#3a3a4e]',
    ghost: 'bg-transparent hover:bg-white/5 text-[#a0a0b0] hover:text-white focus:ring-[#3a3a4e]',
    danger: 'bg-[#ef4444] hover:bg-[#dc2626] text-white focus:ring-[#ef4444] shadow-lg shadow-[#ef4444]/20',
    outline: 'bg-transparent border border-[#2a2a3e] hover:border-[#ff79c6] text-[#a0a0b0] hover:text-white focus:ring-[#ff79c6]',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
