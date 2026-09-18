'use client';

import ClientOnly from '@/components/ClientOnly';
import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Lock, Zap, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An error occurred resetting your password. The token may be expired.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-2">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Password Reset!</h2>
          <p className="text-[#6b6b7b] text-sm mt-2">
            Your password has been successfully updated. You can now log in with your new password.
          </p>
        </div>
        <Link href="/login" className="inline-flex items-center justify-center w-full h-11 rounded-lg bg-[#ff79c6] hover:bg-[#ff92df] text-white font-medium transition-colors">
          Go to Login
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 mb-2">
          <Lock className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Invalid Link</h2>
          <p className="text-[#6b6b7b] text-sm mt-2">
            This password reset link is invalid or missing the secure token. Please request a new link.
          </p>
        </div>
        <Link href="/forgot-password" className="inline-flex items-center justify-center w-full h-11 rounded-lg bg-[#ff79c6] hover:bg-[#ff92df] text-white font-medium transition-colors">
          Request New Link
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <p className="text-[#6b6b7b] text-sm">Please enter and confirm your new password below.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="New Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="w-4 h-4" />}
          required
        />

        <Input
          label="Confirm New Password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={<Lock className="w-4 h-4" />}
          required
        />

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20">
            <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
            <p className="text-sm text-[#ef4444]">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          loading={loading}
          className="w-full h-11 text-sm font-medium"
          size="lg"
        >
          Reset Password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <ClientOnly>
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#ff79c6]/10 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#d68eff]/10 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff79c6]/5 rounded-full blur-[200px]" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff79c6] to-[#d68eff] mb-6 shadow-lg shadow-[#ff79c6]/30">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Choose New Password
          </h1>
        </div>

        <div className="relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-r from-[#ff79c6] via-[#d68eff] to-[#ff79c6] rounded-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 blur-[1px]" />
          <div className="relative bg-[#12121a]/95 backdrop-blur-xl rounded-2xl p-8 border border-[#2a2a3e]/50">
            <Suspense fallback={<div className="text-white text-center py-4">Loading...</div>}>
              <ResetPasswordForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
    </ClientOnly>
  );
}
