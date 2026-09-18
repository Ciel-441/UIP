'use client';

import ClientOnly from '@/components/ClientOnly';
import React, { useState, useEffect, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import { profileApi } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { User, Calendar, Briefcase, UserCircle, AlignLeft, CheckCircle2, Upload, Trash2, Shield, KeyRound, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { authApi } from '@/lib/api';

export default function ProfileSettingsPage() {
  const { user, fetchUser } = useAuth() as any; // Cast for now, need to add fetchUser to useAuth
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  const [devToken, setDevToken] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState({
    nickname: '',
    gender: '',
    dob: '',
    bio: '',
    position: '',
    pfp_url: '',
    status: 'online'
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await profileApi.get();
      let dobString = res.data.dob || '';
      if (dobString && dobString.includes('T')) {
        dobString = dobString.split('T')[0];
      }
      setProfile({
        nickname: res.data.nickname || '',
        gender: res.data.gender || '',
        dob: dobString,
        bio: res.data.bio || '',
        position: res.data.position || '',
        pfp_url: res.data.pfp_url || '',
        status: res.data.status || 'online'
      });
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-[#10b981]';
      case 'working': return 'bg-[#d68eff]';
      case 'free': return 'bg-[#3b82f6]';
      case 'dnd': return 'bg-[#ef4444]';
      case 'sleeping': return 'bg-[#6b7280]';
      case 'offline': return 'bg-transparent border border-[#6b7280]';
      default: return 'bg-[#10b981]'; // Default online
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      // Auto-generate DiceBear avatar if nickname is set and pfp_url is empty
      let finalPfp = profile.pfp_url;
      if (!finalPfp && profile.nickname) {
        finalPfp = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(profile.nickname)}`;
      }

      const updateData = { ...profile, pfp_url: finalPfp };
      await profileApi.update(updateData);
      setProfile(updateData);
      setSuccessMsg('Profile updated successfully!');
      if (fetchUser) await fetchUser(); // Reload auth context if available
      
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to save profile', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setProfile(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await profileApi.uploadPfp(file);
      setProfile(prev => ({ ...prev, pfp_url: res.data.pfp_url }));
      if (fetchUser) await fetchUser(); // Reload auth context
    } catch (err) {
      console.error('Failed to upload image', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!user?.email) return;
    setResetLoading(true);
    setResetSuccess('');
    setResetError('');
    setDevToken(null);
    try {
      const res = await authApi.forgotPassword(user.email);
      setResetSuccess('Password reset link sent to your connected email.');
      if (res.data?.dev_token) {
        setDevToken(res.data.dev_token);
      }
    } catch (err: any) {
      setResetError(err.response?.data?.detail || 'Failed to send reset link.');
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-full items-center justify-center">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
            <p className="text-[#a0a0b0]">Manage your personal and professional identity.</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          
          {/* Avatar Section */}
          <div className="bg-[#12121a]/95 border border-[#2a2a3e]/50 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-[#1e1e2d] border border-[#2a2a3e] flex flex-shrink-0 items-center justify-center overflow-hidden relative group">
                  {profile.pfp_url ? (
                    <img src={profile.pfp_url} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <UserCircle className="w-12 h-12 text-[#6b6b7b]" />
                  )}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Spinner size="sm" />
                    </div>
                  )}
                </div>
                <div className={`absolute bottom-1 right-1 w-6 h-6 rounded-full border-4 border-[#12121a]/95 ${getStatusColor(profile.status)} z-10`} title={profile.status} />
              </div>
              <div className="flex-1">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden" 
                />
                <div className="flex items-center gap-3 mb-3">
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    icon={<Upload className="w-4 h-4" />}
                  >
                    Upload Image
                  </Button>
                  {profile.pfp_url && (
                    <button 
                      type="button"
                      onClick={() => setProfile(prev => ({ ...prev, pfp_url: '' }))}
                      className="text-[#ef4444] p-2 hover:bg-[#ef4444]/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#a0a0b0]">
                  You can upload a custom profile picture, or just save your nickname and we'll auto-generate a beautiful avatar using <a href="https://dicebear.com" target="_blank" rel="noreferrer" className="text-[#ff79c6] hover:underline">DiceBear</a>!
                </p>
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="bg-[#12121a]/95 border border-[#2a2a3e]/50 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Nickname / Display Name"
                name="nickname"
                value={profile.nickname}
                onChange={handleChange}
                placeholder="How should we call you?"
                icon={<User className="w-4 h-4" />}
              />
              
              <Input
                label="Date of Birth"
                type="date"
                name="dob"
                value={profile.dob}
                onChange={handleChange}
                icon={<Calendar className="w-4 h-4" />}
              />
              
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#a0a0b0]">Gender</label>
                <div className="relative">
                  <select
                    name="gender"
                    value={profile.gender}
                    onChange={handleChange}
                    className="w-full bg-[#1e1e2d]/50 border border-[#2a2a3e] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff79c6] transition-colors appearance-none"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="female">Female</option>
                    <option value="Non-binary">Non-binary</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#a0a0b0]">Status</label>
                <div className="relative">
                  <select
                    name="status"
                    value={profile.status}
                    onChange={handleChange}
                    className="w-full bg-[#1e1e2d]/50 border border-[#2a2a3e] rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff79c6] transition-colors appearance-none"
                  >
                    <option value="online">Online</option>
                    <option value="working">Working</option>
                    <option value="free">Free</option>
                    <option value="dnd">Do Not Disturb</option>
                    <option value="sleeping">Sleeping</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Details */}
          <div className="bg-[#12121a]/95 border border-[#2a2a3e]/50 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Professional Details</h2>
            <div className="space-y-6">
              <Input
                label="Job Position / Role"
                name="position"
                value={profile.position}
                onChange={handleChange}
                placeholder="e.g. Senior Analyst, Marketing Director"
                icon={<Briefcase className="w-4 h-4" />}
              />
              
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#a0a0b0]">Bio</label>
                <div className="relative">
                  <AlignLeft className="absolute left-3 top-3 w-4 h-4 text-[#6b6b7b]" />
                  <textarea
                    name="bio"
                    value={profile.bio}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Tell your team a little bit about yourself..."
                    className="w-full bg-[#1e1e2d]/50 border border-[#2a2a3e] rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#ff79c6] transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Account Security */}
          <div className="bg-[#12121a]/95 border border-[#2a2a3e]/50 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#ff79c6]" />
              Account Security
            </h2>
            <div className="flex flex-col md:flex-row items-start justify-between gap-6">
              <div>
                <h3 className="text-base font-medium text-white">Password Settings</h3>
                <p className="text-sm text-[#a0a0b0] mt-1 max-w-md">
                  Update your password by requesting a secure reset link. The link will be sent to your currently connected email address <strong className="text-white">({user?.email})</strong>.
                </p>
                
                {resetError && (
                  <div className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/20 text-sm text-[#ef4444]">
                    {resetError}
                  </div>
                )}
                
                {resetSuccess && (
                  <div className="mt-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-[#10b981]/10 border border-[#10b981]/20 text-sm text-[#10b981]">
                      <CheckCircle2 className="w-4 h-4" />
                      {resetSuccess}
                    </div>
                    {devToken && (
                      <div className="p-4 rounded-lg bg-[#ff79c6]/10 border border-[#ff79c6]/20">
                        <p className="text-xs text-[#ff79c6] font-semibold mb-2 uppercase tracking-wider">Local Dev Mode Active</p>
                        <Link 
                          href={`/reset-password?token=${devToken}`}
                          className="inline-flex items-center text-[#ff79c6] text-sm font-medium hover:text-[#ff92df] transition-colors"
                        >
                          Click here to reset your password now <ArrowRight className="w-4 h-4 ml-1" />
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 w-full md:w-auto">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleSendResetLink} 
                  loading={resetLoading}
                  icon={<KeyRound className="w-4 h-4" />}
                  className="w-full md:w-auto border-[#2a2a3e] hover:border-[#ff79c6] hover:text-[#ff79c6]"
                >
                  Send Reset Link
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 border-t border-[#2a2a3e]/50 pt-6">
            {successMsg && (
              <span className="flex items-center text-[#10b981] text-sm animate-fade-in">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {successMsg}
              </span>
            )}
            <Button type="submit" loading={saving} icon={<CheckCircle2 className="w-4 h-4" />}>
              Save Profile
            </Button>
          </div>
        </form>

      </div>
    </AppShell>
  );
}
