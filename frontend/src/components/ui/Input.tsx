'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export default function Input({ label, error, icon, className, id, type, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s/g, '-');
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-[#a0a0b0]">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b7b]">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          type={isPassword && showPassword ? 'text' : type}
          className={cn(
            'w-full bg-[#12121a] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white placeholder-[#6b6b7b] transition-colors duration-200',
            'focus:outline-none focus:border-[#ff79c6] focus:ring-1 focus:ring-[#ff79c6]/50',
            'hover:border-[#3a3a4e]',
            icon ? 'pl-10' : '',
            isPassword ? 'pr-10' : '',
            error ? 'border-[#ef4444] focus:border-[#ef4444] focus:ring-[#ef4444]/50' : '',
            className
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b6b7b] hover:text-[#a0a0b0] transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  );
}
