'use client';

import ClientOnly from '@/components/ClientOnly';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Spinner from '@/components/ui/Spinner';

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(isAuthenticated ? '/dashboard' : '/login');
    }
  }, [loading, isAuthenticated, router]);

  return (
    <ClientOnly>
    <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
      <Spinner size="lg" />
    </div>
    </ClientOnly>
  );
}
