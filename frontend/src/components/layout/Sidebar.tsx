'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Network,
  FileText,
  Search,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Compass,
  Database,
  Globe2,
  Activity,
  Server,
  ShieldCheck
} from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Digital Twins', href: '/digital-twins', icon: Globe2 },
  { name: 'Investigations', href: '/investigations', icon: Compass },
  { name: 'Knowledge Graph', href: '/graph', icon: Network },
  { name: 'Entities', href: '/entities', icon: Database },
  { name: 'Discovery', href: '/discovery', icon: Compass },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Team Chat', href: '/chat', icon: MessageSquare },
  { name: 'Search', href: '/search', icon: Search },
  { name: 'AI Assistant', href: '/assistant', icon: MessageSquare },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Extraction Rules', href: '/settings/extraction-rules', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const adminNavItem = { name: 'Admin Panel', href: '/admin', icon: ShieldCheck };

const MotionLink = motion(Link);

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileMenuOpen?: boolean;
  setMobileMenuOpen?: (val: boolean) => void;
}

export default function Sidebar({ collapsed, onToggle, mobileMenuOpen, setMobileMenuOpen }: SidebarProps) {
  const pathname = usePathname();
  const { activeRoom, myRole } = useRoom();

  const currentNavItems = myRole === 'admin' ? [...navItems, adminNavItem] : navItems;

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" 
          onClick={() => setMobileMenuOpen?.(false)}
        />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 h-[100dvh] bg-[#0a0a0f] border-r border-[#2a2a3e] flex flex-col transition-all duration-300 z-50 overflow-hidden',
          mobileMenuOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0',
          collapsed ? 'md:w-[72px]' : 'md:w-[260px]'
        )}
      >
      {/* Brand & Workspace Switcher */}
      <div className="flex flex-col px-5 py-4 border-b border-[#2a2a3e] gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 shadow-lg border border-white/10 relative group">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="text-sm font-bold text-white leading-tight whitespace-nowrap">Unified Intelligence</h1>
              <p className="text-[10px] text-[#6b6b7b] font-medium">Platform v1.0</p>
            </div>
          )}
        </div>
        {!collapsed && activeRoom && (
          <div className="mt-2 p-2 rounded-lg bg-[#12121a] border border-[#2a2a3e] flex items-center justify-between group cursor-pointer hover:border-accent/50 transition-colors" onClick={() => window.location.href = '/rooms'}>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{activeRoom.name}</p>
              <p className="text-[10px] text-[#a0a0b0] capitalize">{myRole}</p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#4b4b6b] group-hover:text-accent" />
          </div>
        )}
        {collapsed && activeRoom && (
          <div className="mx-auto mt-2 w-8 h-8 rounded-lg bg-[#12121a] border border-[#2a2a3e] flex items-center justify-center cursor-pointer" onClick={() => window.location.href = '/rooms'} title={activeRoom.name}>
            <span className="text-xs font-bold text-[#a0a0b0]">{activeRoom.name.substring(0, 2).toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {currentNavItems.map((item) => {
          const activeItem = [...currentNavItems]
            .sort((a, b) => b.href.length - a.href.length)
            .find(n => pathname === n.href || pathname?.startsWith(n.href + '/'));
            
          const isActive = activeItem?.href === item.href;
          const Icon = item.icon;
          return (
            <MotionLink
              key={item.href}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group relative overflow-hidden',
                isActive
                  ? 'text-accent'
                  : 'text-[#6b6b7b] hover:text-[#a0a0b0]'
              )}
              whileHover={{ x: collapsed ? 0 : 4, scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              transition={{ type: 'spring', stiffness: 450, damping: 25 }}
            >
              {isActive && (
                <motion.div
                   layoutId="activeNavBackground"
                  className="absolute inset-0 bg-accent/10 rounded-lg -z-10"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {isActive && (
                <motion.div 
                   layoutId="activeNavIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r" 
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className={cn('w-5 h-5 flex-shrink-0 relative z-10', isActive && 'text-accent')} />
              {!collapsed && <span className="whitespace-nowrap relative z-10">{item.name}</span>}
            </MotionLink>
          );
        })}
      </nav>

      {/* AI Status */}
      {!collapsed && (
        <div className="mx-3 mb-2 p-3 rounded-lg bg-gradient-to-br from-accent/10 to-accent-secondary/10 border border-accent/20">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-xs font-medium text-[#a0a0b0]">AI Powered</span>
          </div>
          <p className="text-[10px] text-[#6b6b7b] mt-1">Ollama LLM Integration</p>
        </div>
      )}

      {/* Legal & Policy Links */}
      {!collapsed && (
        <div className="px-5 py-2 flex items-center justify-between text-[10px] text-[#6b6b7b] border-t border-[#2a2a3e]/40">
          <Link href="/terms" className="hover:text-accent transition-colors">
            Terms & Conditions
          </Link>
          <span>•</span>
          <Link href="/privacy" className="hover:text-accent transition-colors">
            Privacy Policy
          </Link>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="px-3 pb-4">
        <motion.button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[#6b6b7b] hover:text-[#a0a0b0] hover:bg-white/5 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </motion.button>
      </div>
    </aside>
    </>
  );
}
