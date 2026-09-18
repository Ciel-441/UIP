'use client';

import ClientOnly from '@/components/ClientOnly';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Mail, Zap, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      if (res.data?.dev_token) {
        setDevToken(res.data.dev_token);
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClientOnly>
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#ff79c6]/10 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#d68eff]/10 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff79c6]/5 rounded-full blur-[200px]" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ff79c6] to-[#d68eff] mb-6 shadow-lg shadow-[#ff79c6]/30">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Reset Password
          </h1>
        </div>

        {/* Card */}
        <div className="relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-r from-[#ff79c6] via-[#d68eff] to-[#ff79c6] rounded-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 blur-[1px]" />
          
          <div className="relative bg-[#12121a]/95 backdrop-blur-xl rounded-2xl p-8 border border-[#2a2a3e]/50">
            {success ? (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-2">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Check your email</h2>
                  <p className="text-[#6b6b7b] text-sm mt-2">
                    We've sent password reset instructions to <span className="text-white font-medium">{email}</span>.
                  </p>
                  
                  {devToken && (
                    <div className="mt-4 p-4 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/20 text-left">
                      <p className="text-xs text-[#ff79c6] font-semibold mb-2 uppercase tracking-wider">Local Dev Mode Active</p>
                      <p className="text-sm text-[#a0a0b0] mb-3">Since SMTP isn't configured, here is your reset link:</p>
                      <Link 
                        href={`/reset-password?token=${devToken}`}
                        className="inline-block px-4 py-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-md text-[#ff79c6] text-sm font-medium hover:bg-[#2a2a3e] transition-colors break-all"
                      >
                        Reset Password Link
                      </Link>
                    </div>
                  )}
                </div>
                <Link href="/login" className="inline-flex items-center justify-center w-full h-11 rounded-lg bg-[#ff79c6] hover:bg-[#ff92df] text-white font-medium transition-colors">
                  Return to Login
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-[#6b6b7b] text-sm">Enter the email address associated with your account and we'll send you a link to reset your password.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Mail className="w-4 h-4" />}
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
                    Send Reset Link
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center text-sm text-[#6b6b7b] hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
    </ClientOnly>
  );
}
