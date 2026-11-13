'use client';

import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { entityApi } from '@/lib/api';
import { Network, Search, Merge, Check, X, ShieldAlert } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function EntityResolutionDashboard() {
  const [duplicates, setDuplicates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDuplicates();
  }, []);

  const fetchDuplicates = async () => {
    try {
      const res = await entityApi.getDuplicates(0.8);
      setDuplicates(res.data || []);
    } catch (err) {
      console.error('Failed to fetch duplicates', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (targetId: string, sourceId: string) => {
    try {
      await entityApi.merge(targetId, sourceId);
      // Refresh list
      fetchDuplicates();
    } catch (err) {
      console.error('Failed to merge entities', err);
    }
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <Merge className="w-8 h-8 text-[#ff79c6]" />
              Entity Resolution
            </h1>
            <p className="text-[#a0a0b0] mt-2 text-lg">
              Detect and merge duplicate entities to consolidate knowledge.
            </p>
          </div>
          <Button variant="secondary" onClick={fetchDuplicates} disabled={loading}>
            Refresh Analysis
          </Button>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-[#a0a0b0] text-center py-12">Analyzing graph...</div>
          ) : duplicates.length === 0 ? (
            <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-12 text-center flex flex-col items-center">
              <ShieldAlert className="w-12 h-12 text-[#10b981] mb-4" />
              <h3 className="text-xl font-medium text-white">Graph is Clean</h3>
              <p className="text-[#a0a0b0] mt-2">No duplicate entities detected above the similarity threshold.</p>
            </div>
          ) : (
            duplicates.map((dup, i) => (
              <div key={i} className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-6 hover:border-[#ff79c6]/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 p-4 bg-[#1a1a2e] rounded-xl border border-[#2a2a3e]">
                        <span className="text-xs text-[#a0a0b0] uppercase tracking-wider font-medium mb-1 block">Target Entity</span>
                        <div className="font-medium text-white">{dup.entity1.name}</div>
                        <div className="text-xs text-[#ff79c6] mt-1">{dup.entity1.type}</div>
                      </div>
                      <Merge className="w-6 h-6 text-[#6b6b7b] shrink-0" />
                      <div className="flex-1 p-4 bg-[#1a1a2e] rounded-xl border border-[#2a2a3e]">
                        <span className="text-xs text-[#a0a0b0] uppercase tracking-wider font-medium mb-1 block">Source Entity</span>
                        <div className="font-medium text-white">{dup.entity2.name}</div>
                        <div className="text-xs text-[#ff79c6] mt-1">{dup.entity2.type}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-[#a0a0b0]">Similarity Score:</div>
                      <div className="px-2 py-0.5 rounded-full bg-[#10b981]/10 text-[#10b981] text-xs font-medium border border-[#10b981]/20">
                        {Math.round(dup.similarity_score * 100)}%
                      </div>
                    </div>
                  </div>
                  <div className="pl-6 ml-6 border-l border-[#2a2a3e] flex flex-col gap-2 shrink-0">
                    <Button 
                      variant="primary" 
                      onClick={() => handleMerge(dup.entity1.id, dup.entity2.id)}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Merge Left
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => handleMerge(dup.entity2.id, dup.entity1.id)}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Merge Right
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
