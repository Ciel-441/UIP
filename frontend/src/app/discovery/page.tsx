'use client';

import React, { useState, useEffect } from 'react';
import { Compass, Zap, BrainCircuit, Search, ChevronRight, Hash, ShieldAlert, Sparkles, Filter, Activity, ArrowDownUp } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import api from '@/lib/api';

interface FeedItem {
  id: number;
  type: string;
  title: string;
  description: string;
  status: string;
  confidence: number;
  timestamp: string;
  evidence?: any[];
}

export default function DiscoveryFeedPage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  const toggleEvidence = (id: number) => {
    setExpandedItemId(expandedItemId === id ? null : id);
  };

  useEffect(() => {
    fetchFeed();
    const interval = setInterval(fetchFeed, 10000); // Poll every 10s for new discoveries
    return () => clearInterval(interval);
  }, []);

  const fetchFeed = async () => {
    try {
      const res = await api.get('/api/feed');
      setFeed(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'supported': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'contradicted': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'emerging': return 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20';
      default: return 'text-[#ff79c6] bg-[#ff79c6]/10 border-[#ff79c6]/20';
    }
  };

  const filteredFeed = feed
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterStatus === 'all' || item.status === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (sortBy === 'oldest') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      if (sortBy === 'confidence_high') return b.confidence - a.confidence;
      if (sortBy === 'confidence_low') return a.confidence - b.confidence;
      return 0;
    });

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto animate-fade-in">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b]/20 to-[#ef4444]/20 border border-[#f59e0b]/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#f59e0b]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Discovery Feed</h1>
              <p className="text-sm text-[#a0a0b0]">Real-time autonomous intelligence stream</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b7b]" />
              <input
                type="text"
                placeholder="Search discoveries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#12121a] border border-[#2a2a3e] rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#ff79c6] w-48 sm:w-64 transition-colors"
              />
            </div>
            <div className="flex items-center gap-2 bg-[#12121a] border border-[#2a2a3e] rounded-xl px-3 py-2 hover:border-[#3a3a4e] transition-colors">
              <Filter className="w-4 h-4 text-[#6b6b7b]" />
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-[#12121a]">All Status</option>
                <option value="emerging" className="bg-[#12121a]">Emerging</option>
                <option value="supported" className="bg-[#12121a]">Supported</option>
                <option value="contradicted" className="bg-[#12121a]">Contradicted</option>
              </select>
            </div>
            <div className="flex items-center gap-2 bg-[#12121a] border border-[#2a2a3e] rounded-xl px-3 py-2 hover:border-[#3a3a4e] transition-colors">
              <ArrowDownUp className="w-4 h-4 text-[#6b6b7b]" />
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-[#12121a]">Newest First</option>
                <option value="oldest" className="bg-[#12121a]">Oldest First</option>
                <option value="confidence_high" className="bg-[#12121a]">Highest Confidence</option>
                <option value="confidence_low" className="bg-[#12121a]">Lowest Confidence</option>
              </select>
            </div>
          </div>
        </header>

        {loading && feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#6b6b7b]">
            <Activity className="w-8 h-8 animate-spin mb-4 text-[#ff79c6]" />
            <p>Scanning intelligence feeds...</p>
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="text-center py-20 bg-[#12121a] border border-[#2a2a3e] rounded-2xl">
            <Search className="w-12 h-12 text-[#ff79c6]/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No Match Found</h3>
            <p className="text-[#a0a0b0] max-w-sm mx-auto">No discoveries match your current search and filter criteria.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 pb-4 scroll-smooth" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a3e transparent' }}>
            {filteredFeed.map((item) => (
              <div key={item.id} className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-6 shadow-xl hover:border-[#3a3a4e] transition-all relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#ff79c6] to-[#d68eff] opacity-50 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#1a1a24] flex items-center justify-center shrink-0">
                      <BrainCircuit className="w-4 h-4 text-[#d68eff]" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{item.title}</h3>
                      <p className="text-xs text-[#6b6b7b]">{new Date(item.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(item.status)}`}>
                    {item.status.toUpperCase()}
                  </div>
                </div>
                
                <p className="text-sm text-[#a0a0b0] leading-relaxed mb-4">
                  {item.description}
                </p>
                
                <div className="flex items-center justify-between border-t border-[#2a2a3e] pt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#6b6b7b]">AI Confidence:</span>
                    <div className="w-24 h-1.5 bg-[#1a1a24] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#ff79c6] to-[#d68eff]" 
                        style={{ width: `${item.confidence * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-semibold text-white ml-1">{Math.round(item.confidence * 100)}%</span>
                  </div>
                  
                  <button 
                    onClick={() => toggleEvidence(item.id)}
                    className="text-xs font-medium text-[#ff79c6] hover:text-[#d68eff] flex items-center gap-1 transition-colors"
                  >
                    {expandedItemId === item.id ? 'Hide Evidence' : 'View Evidence'} 
                    <ChevronRight className={`w-3 h-3 transition-transform ${expandedItemId === item.id ? 'rotate-90' : ''}`} />
                  </button>
                </div>
                
                {expandedItemId === item.id && item.evidence && (
                  <div className="mt-4 pt-4 border-t border-[#2a2a3e] bg-[#0a0a0f] p-4 rounded-lg">
                    <h4 className="text-sm font-semibold text-white mb-2">Supporting Evidence</h4>
                    <ul className="space-y-2">
                      {item.evidence.map((ev, idx) => (
                        <li key={idx} className="text-xs text-[#a0a0b0] bg-[#13131a] p-2 rounded border border-[#2a2a3e]">
                          <span className="font-medium text-[#ff79c6] capitalize">{ev.type}:</span> {ev.data || ev.fact || JSON.stringify(ev)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
