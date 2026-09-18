'use client';

import ClientOnly from '@/components/ClientOnly';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { Mail, Lock, User, Zap } from 'lucide-react';
import Link from 'next/link';
import Galaxy from '@/components/ui/Galaxy';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name);
      router.push('/verify');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ClientOnly>
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#d68eff]/10 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#ff79c6]/10 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#d68eff]/5 rounded-full blur-[200px]" />

      <div className="absolute inset-0 z-0 opacity-50">
        <Galaxy transparent={true} />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl overflow-hidden mb-6 shadow-xl border border-white/10 bg-[#12121a]">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Unified Intelligence
          </h1>
          <p className="text-[#6b6b7b] mt-2 text-sm">
            Platform
          </p>
        </div>

        {/* Register Card with gradient border */}
        <div className="relative group">
          {/* Gradient border effect */}
          <div className="absolute -inset-[1px] bg-gradient-to-r from-[#d68eff] via-[#ff79c6] to-[#d68eff] rounded-2xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 blur-[1px]" />
          
          <div className="relative bg-[#12121a]/95 backdrop-blur-xl rounded-2xl p-8 border border-[#2a2a3e]/50">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">Create Account</h2>
              <p className="text-[#6b6b7b] text-sm mt-1">Get started with your intelligence platform</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Full Name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={<User className="w-4 h-4" />}
                required
                id="register-name"
              />

              <Input
                label="Email Address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="w-4 h-4" />}
                required
                id="register-email"
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
                id="register-password"
              />

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
                  <p className="text-sm text-[#ef4444]">{error}</p>
                </div>
              )}

              <div className="text-[11px] text-[#72687d] leading-relaxed">
                By creating an account, you acknowledge that this platform is provided "AS IS" and agree to our{' '}
                <Link href="/terms" target="_blank" className="text-[#ff79c6] hover:underline font-medium">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" target="_blank" className="text-[#ff79c6] hover:underline font-medium">
                  Privacy Policy
                </Link>
                , including full assumption of risk regarding project usage and uncensored AI model outputs.
              </div>

              <Button
                type="submit"
                loading={loading}
                className="w-full h-11 text-sm font-medium"
                size="lg"
                id="register-submit"
              >
                Create Account
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-[#6b6b7b]">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-[#ff79c6] hover:text-[#ff92df] font-medium transition-colors"
                  id="register-login-link"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom text */}
        <div className="mt-8 text-center space-y-2">
          <div className="flex items-center justify-center gap-4 text-xs text-[#a8a0b0]">
            <Link href="/terms" className="hover:text-[#ff79c6] transition-colors">
              Terms of Service
            </Link>
            <span className="text-[#3d1f43]">•</span>
            <Link href="/privacy" className="hover:text-[#ff79c6] transition-colors">
              Privacy Policy
            </Link>
          </div>
          <p className="text-xs text-[#6b6b7b]/50">
            Enterprise Knowledge Intelligence Platform
          </p>
        </div>
      </div>
    </div>
    </ClientOnly>
  );
}
