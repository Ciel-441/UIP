'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export default function Select({ label, error, options, className, id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s/g, '-');
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-[#a0a0b0]">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            'w-full bg-[#12121a] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white appearance-none',
            'focus:outline-none focus:border-[#ff79c6] focus:ring-1 focus:ring-[#ff79c6]/50',
            'hover:border-[#3a3a4e] transition-colors duration-200',
            error && 'border-[#ef4444]',
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b7b] pointer-events-none" />
      </div>
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  );
}
