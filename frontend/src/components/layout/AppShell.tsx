'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useRoom } from '@/hooks/useRoom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import Spinner from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import { MessageSquare, X, UserCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const getRouteTransitionVariants = (path: string | null) => {
  if (!path) return {
    initial: { opacity: 0, y: 12 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -12 }
  };
  
  if (path.includes('/dashboard')) {
    // Keep Dashboard slide-up clean (it handles its own interior component animation)
    return {
      initial: { opacity: 0, y: 15 },
      in: { opacity: 1, y: 0 },
      out: { opacity: 0, y: -15 }
    };
  }
  if (path.includes('/chat')) {
    return {
      initial: { opacity: 0, x: 30 },
      in: { opacity: 1, x: 0 },
      out: { opacity: 0, x: -30 }
    };
  }
  if (path.includes('/graph')) {
    return {
      initial: { opacity: 0, y: 20 },
      in: { opacity: 1, y: 0 },
      out: { opacity: 0, y: -20 }
    };
  }
  if (path.includes('/settings')) {
    return {
      initial: { opacity: 0, y: -40 },
      in: { opacity: 1, y: 0 },
      out: { opacity: 0, y: 30 }
    };
  }
  if (path.includes('/documents')) {
    return {
      initial: { opacity: 0, y: 40 },
      in: { opacity: 1, y: 0 },
      out: { opacity: 0, y: -40 }
    };
  }
  if (path.includes('/investigations')) {
    return {
      initial: { opacity: 0, y: 20 },
      in: { opacity: 1, y: 0 },
      out: { opacity: 0, y: -20 }
    };
  }
  if (path.includes('/analytics')) {
    return {
      initial: { opacity: 0, y: 25 },
      in: { opacity: 1, y: 0 },
      out: { opacity: 0, y: -25 }
    };
  }
  return {
    initial: { opacity: 0, y: 12 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -12 }
  };
};

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { activeRoomId, loading: roomLoading } = useRoom();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
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

  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    setIsTransitioning(true);
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && isAuthenticated && !roomLoading && !activeRoomId && pathname !== '/rooms') {
      router.push('/rooms');
    }
  }, [authLoading, isAuthenticated, roomLoading, activeRoomId, pathname, router]);

  const addToast = (msg: any) => {
    const id = Date.now();
    setToasts(prev => [...prev, { ...msg, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    if (!user) return;
    
    let ws: WebSocket | null = null;
    const connectWs = () => {
      const isSecure = window.location.protocol === 'https:';
      const wsProtocol = isSecure ? 'wss:' : 'ws:';
      const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      let wsUrl = '';
      if (apiUrl) {
        const urlWithoutProtocol = apiUrl.replace(/^https?:\/\//, '');
        wsUrl = `${wsProtocol}//${urlWithoutProtocol}/api/communication/ws/${user.id}`;
      } else {
        wsUrl = `${wsProtocol}//${host}/api/communication/ws/${user.id}`;
      }

      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_message') {
            // Ignore if user sent it themselves
            if (data.message.sender.id === user.id) return;
            
            // Ignore if currently looking at this conversation
            const activeConvId = localStorage.getItem('activeConvId');
            if (window.location.pathname.includes('/chat') && activeConvId === data.message.conversation_id.toString()) {
              return;
            }
            
            addToast({
              title: data.message.sender.name,
              content: data.message.content,
              pfp_url: data.message.sender.pfp_url,
              conversation_id: data.message.conversation_id
            });
          } else if (data.type === 'room_join_request') {
            addToast({
              title: 'New Join Request',
              content: `${data.user_name} requested to join ${data.room_name}.`
            });
            window.dispatchEvent(new CustomEvent('room_join_request', { detail: data }));
          } else if (data.type === 'room_approved') {
            addToast({
              title: 'Access Granted',
              content: `You were approved to join ${data.room_name}!`
            });
            window.dispatchEvent(new CustomEvent('room_approved', { detail: data }));
          } else if (data.type === 'room_kicked') {
            addToast({
              title: 'Removed from Room',
              content: `You have been removed from the Data Room: ${data.room_name || 'workspace'}`
            });
            localStorage.removeItem('active_room_id');
            setTimeout(() => {
              window.location.href = '/rooms';
            }, 1000);
          }
        } catch(e) {}
      };
    };
    
    connectWs();
    return () => {
      if (ws) ws.close();
    };
  }, [user]);

  if (authLoading || roomLoading || !user) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-[#0a0a0f]">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-sm text-[#6b6b7b]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const isNoPaddingRoute = pathname?.includes('/chat') || pathname?.includes('/graph') || pathname === '/rooms';
  const isRoomsRoute = pathname === '/rooms';

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0f]">
      {!isRoomsRoute && (
        <Sidebar 
          collapsed={collapsed} 
          onToggle={() => setCollapsed(!collapsed)} 
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      )}
      <div className={cn(
        'transition-all duration-300 flex flex-col h-[100dvh]',
        isRoomsRoute ? 'ml-0' : (collapsed ? 'ml-0 md:ml-[72px]' : 'ml-0 md:ml-[260px]')
      )}>
        {!isRoomsRoute && <TopBar onMobileMenuToggle={() => setMobileMenuOpen(true)} />}
        <main className={cn('flex-1', isNoPaddingRoute ? 'p-0 overflow-hidden' : 'p-4 md:p-6 overflow-y-auto')}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={isMobile ? { opacity: 0 } : "initial"}
              animate={isMobile ? { opacity: 1 } : "in"}
              exit={isMobile ? { opacity: 0 } : "out"}
              variants={isMobile ? undefined : getRouteTransitionVariants(pathname)}
              transition={isMobile ? { duration: 0.18, ease: 'easeOut' } : { type: 'spring', stiffness: 220, damping: 28 }}
              className={cn("w-full h-full", (pathname !== '/dashboard' && isTransitioning) && "animate-page-content")}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className="w-80 bg-[#12121a]/95 backdrop-blur-xl border border-[#2a2a3e] rounded-xl shadow-2xl p-4 flex gap-3 animate-fade-in pointer-events-auto"
          >
            <div className="w-10 h-10 rounded-full bg-[#2a2a3e] overflow-hidden shrink-0 border border-[#2a2a3e]">
              {toast.pfp_url ? (
                <img src={toast.pfp_url} alt="pfp" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-full h-full text-[#6b6b7b]" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex justify-between items-start">
                <h4 className="text-sm font-semibold text-white truncate pr-2">{toast.title}</h4>
                <button 
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-[#6b6b7b] hover:text-white mt-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-[#a0a0b0] truncate mt-1">
                {toast.content.includes('[Attachment:') ? '📎 Sent an attachment' : toast.content}
              </p>
              <button 
                onClick={() => {
                  if (toast.conversation_id) {
                    router.push(`/chat?convId=${toast.conversation_id}`);
                  } else {
                    router.push('/chat');
                  }
                }}
                className="text-[10px] text-[#ff79c6] hover:text-[#ff92df] mt-2 font-medium uppercase tracking-wider"
              >
                Reply in Chat
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
