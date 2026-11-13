'use client';

import React, { useState, useEffect } from 'react';
import { Compass, Search, Plus, Activity, CheckCircle2, XCircle, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import api from '@/lib/api';

interface Investigation {
  id: number;
  title: string;
  goal: string;
  status: string;
  domain: string;
  created_at: string;
}

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGoal, setNewGoal] = useState('');
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    fetchInvestigations();
  }, []);

  const fetchInvestigations = async () => {
    try {
      const res = await api.get('/api/investigations');
      setInvestigations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const launchInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim() || launching) return;

    setLaunching(true);
    try {
      await api.post('/api/investigations/launch', { goal: newGoal });
      setNewGoal('');
      fetchInvestigations();
    } catch (err) {
      console.error(err);
    } finally {
      setLaunching(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Activity className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto animate-fade-in">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff79c6]/20 to-[#d68eff]/20 border border-[#ff79c6]/30 flex items-center justify-center">
              <Compass className="w-5 h-5 text-[#ff79c6]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Autonomous Investigations</h1>
              <p className="text-sm text-[#a0a0b0]">Launch multi-agent research operations in the background</p>
            </div>
          </div>
        </header>

        {/* Launch Card */}
        <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-6 mb-8 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Launch New Investigation</h2>
          <form onSubmit={launchInvestigation} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b6b7b]" />
              <input
                type="text"
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="E.g., Investigate the impact of climate change on wheat yield..."
                className="w-full bg-[#0a0a0f] border border-[#2a2a3e] rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-[#6b6b7b] focus:outline-none focus:border-[#ff79c6] focus:ring-1 focus:ring-[#ff79c6]/30 transition-all"
                disabled={launching}
              />
            </div>
            <button
              type="submit"
              disabled={!newGoal.trim() || launching}
              className="px-6 py-3 bg-[#ff79c6] hover:bg-[#ff92df] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-[#ff79c6]/20"
            >
              {launching ? <Activity className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Launch
            </button>
          </form>
        </div>

        {/* Active & Past Investigations */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Investigation History</h2>
          
          {loading ? (
            <div className="text-center py-12 text-[#6b6b7b]"><Activity className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : investigations.length === 0 ? (
            <div className="text-center py-12 bg-[#12121a] border border-[#2a2a3e] rounded-2xl text-[#a0a0b0]">
              No investigations launched yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {investigations.map(inv => (
                <Link key={inv.id} href={`/investigations/${inv.id}`} className="block">
                  <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-5 hover:border-[#3a3a4e] transition-colors group cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#1a1a24] flex items-center justify-center shrink-0">
                          {getStatusIcon(inv.status)}
                        </div>
                        <div>
                          <h3 className="text-white font-medium mb-1">{inv.title}</h3>
                          <div className="flex items-center gap-3 text-xs text-[#6b6b7b]">
                            <span className="capitalize px-2 py-0.5 bg-[#1e1e2d] rounded-md">{inv.domain || 'General'}</span>
                            <span>•</span>
                            <span>{new Date(inv.created_at).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#4a4a5e] group-hover:text-[#ff79c6] transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
