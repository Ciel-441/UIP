'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { CheckCircle2, XCircle, MailCheck } from 'lucide-react';
import Link from 'next/link';

function VerifyContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>('pending');
  const [message, setMessage] = useState('');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  const verifyToken = async (tokenStr: string) => {
    setStatus('loading');
    try {
      const res = await authApi.verify(tokenStr);
      setStatus('success');
      setMessage(res.data.message);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.detail || 'Verification failed. The link may be invalid or expired.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#d68eff]/10 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#ff79c6]/10 rounded-full blur-[128px] animate-pulse" />
      
      <div className="w-full max-w-md relative z-10 bg-[#12121a]/95 backdrop-blur-xl rounded-2xl p-8 border border-[#2a2a3e]/50 text-center">
        
        {status === 'pending' && !token && (
          <div className="animate-fade-in flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[#ff79c6]/10 flex items-center justify-center mb-6">
              <MailCheck className="w-8 h-8 text-[#ff79c6]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
            <p className="text-[#a0a0b0] mb-8">
              We've sent a verification link to your email address. Please click the link to verify your account and log in.
            </p>
            <Button variant="secondary" onClick={() => router.push('/login')} className="w-full">
              Return to Login
            </Button>
          </div>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center py-8">
            <Spinner size="lg" />
            <p className="mt-4 text-[#a0a0b0]">Verifying your email...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="animate-fade-in flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[#10b981]/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-[#10b981]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Email Verified!</h2>
            <p className="text-[#a0a0b0] mb-8">{message}</p>
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-fade-in flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[#ef4444]/10 flex items-center justify-center mb-6">
              <XCircle className="w-8 h-8 text-[#ef4444]" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-[#ef4444] mb-8">{message}</p>
            <Button variant="secondary" onClick={() => router.push('/login')} className="w-full">
              Return to Login
            </Button>
          </div>
        )}
        
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center"><Spinner /></div>}>
      <VerifyContent />
    </Suspense>
  );
}
