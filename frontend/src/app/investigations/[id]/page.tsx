'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Compass, ArrowLeft, Activity, CheckCircle2, XCircle, Clock } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import api from '@/lib/api';
import ReactMarkdown from 'react-markdown';

interface Investigation {
  id: number;
  title: string;
  goal: string;
  status: string;
  domain: string;
  findings: string[];
  report_markdown: string;
  created_at: string;
  completed_at: string;
}

export default function InvestigationDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [inv, setInv] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchInvestigation();
    
    // Poll for updates if active
    const interval = setInterval(() => {
      if (inv?.status === 'active' || inv?.status === 'reasoning') {
        fetchInvestigation();
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [id, inv?.status]);

  const fetchInvestigation = async () => {
    try {
      const res = await api.get(`/api/investigations/${id}`);
      setInv(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'reasoning':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-400/10 text-blue-400 border border-blue-400/20">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            {status.toUpperCase()}
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-400/10 text-green-400 border border-green-400/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            COMPLETED
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-400/10 text-red-400 border border-red-400/20">
            <XCircle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      default:
        return null;
    }
  };

  if (loading && !inv) {
    return (
      <AppShell>
        <div className="flex justify-center py-20"><Activity className="w-8 h-8 text-[#ff79c6] animate-spin" /></div>
      </AppShell>
    );
  }

  if (!inv) {
    return (
      <AppShell>
        <div className="text-center py-20 text-white">Investigation not found.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto animate-fade-in pb-12">
        <button 
          onClick={() => router.push('/investigations')}
          className="flex items-center gap-2 text-sm text-[#a0a0b0] hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Investigations
        </button>

        <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-8 mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#ff79c6] to-[#d68eff]"></div>
          
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-[#1e1e2d] text-[#a0a0b0] uppercase tracking-wider">
                  {inv.domain || 'General'}
                </span>
                <span className="text-xs text-[#6b6b7b]">
                  {new Date(inv.created_at).toLocaleString()}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">{inv.title}</h1>
              <p className="text-[#a0a0b0]">{inv.goal}</p>
            </div>
            {getStatusBadge(inv.status)}
          </div>
        </div>

        {(inv.status === 'active' || inv.status === 'reasoning') && (
          <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-12 text-center shadow-xl">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-[#ff79c6]/20 border-t-[#ff79c6] animate-spin"></div>
              <Compass className="absolute inset-0 m-auto w-6 h-6 text-[#d68eff] animate-pulse" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Agents are exploring the graph...</h3>
            <p className="text-[#a0a0b0] max-w-md mx-auto">
              The Standardized Reasoning Pipeline is currently querying Neo4j, pulling relevant documents, and synthesizing findings.
            </p>
          </div>
        )}

        {inv.status === 'completed' && inv.report_markdown && (
          <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-8 shadow-xl">
            <div className="prose prose-invert prose-pink max-w-none">
              <ReactMarkdown>{inv.report_markdown}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
