'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { Network, FileText, Activity, Link2, ChevronLeft, Calendar, Tag, ShieldCheck, History } from 'lucide-react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { getEntityColor, getEntityBgColor } from '@/lib/utils';
import Spinner from '@/components/ui/Spinner';
import { entityApi } from '@/lib/api';

export default function EntityProfile() {
  const { id } = useParams();
  const router = useRouter();
  const [entity, setEntity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntity();
  }, [id]);

  const fetchEntity = async () => {
    try {
      const res = await entityApi.get(id as string);
      setEntity(res.data);
    } catch (err) {
      console.error('Failed to fetch entity', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-full">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (!entity) return null;

  const color = getEntityColor(entity.type);
  const bgColor = getEntityBgColor(entity.type);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto p-6 space-y-8 animate-fade-in">
        {/* Header */}
        <div>
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-[#a0a0b0] hover:text-white transition-colors mb-6 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          
          <div className="flex items-start justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                <h1 className="text-4xl font-bold text-white tracking-tight">{entity.name}</h1>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <Badge className="px-3 py-1 text-sm font-medium" style={{ backgroundColor: bgColor, color, borderColor: color + '40' }}>
                  {entity.type}
                </Badge>
                
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#12121a] border border-[#2a2a3e] text-xs text-[#a0a0b0]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
                  Confidence: {Math.round((entity.confidence_score || 1) * 100)}%
                </div>
                
                {entity.created_at && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#12121a] border border-[#2a2a3e] text-xs text-[#a0a0b0]">
                    <Calendar className="w-3.5 h-3.5" />
                    Created: {new Date(entity.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
            
            <Button variant="secondary" onClick={() => router.push(`/graph?entity=${entity.id}`)}>
              View in Graph
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#ff79c6]" />
                Overview
              </h2>
              <p className="text-[#a0a0b0] leading-relaxed">
                {entity.description || "No description available for this entity."}
              </p>
            </div>

            {entity.aliases && entity.aliases.length > 0 && (
              <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-[#ff79c6]" />
                  Aliases
                </h2>
                <div className="flex flex-wrap gap-2">
                  {entity.aliases.map((alias: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 rounded-lg bg-[#1a1a2e] text-sm text-[#a0a0b0] border border-[#2a2a3e]">
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Relationships */}
            <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Network className="w-5 h-5 text-[#ff79c6]" />
                Relationships ({entity.connections?.outgoing?.length + entity.connections?.incoming?.length || 0})
              </h2>
              
              <div className="space-y-4">
                {entity.connections?.outgoing?.map((rel: any, i: number) => (
                  <div key={`out-${i}`} className="flex items-center gap-4 p-3 rounded-xl bg-[#1a1a2e] border border-[#2a2a3e]">
                    <span className="text-sm font-medium text-white px-3">{entity.name}</span>
                    <span className="text-xs font-mono text-[#ff79c6] bg-[#ff79c6]/10 px-2 py-1 rounded">--[{rel.type}]-&gt;</span>
                    <span 
                      className="text-sm font-medium text-white px-3 cursor-pointer hover:text-[#ff79c6] transition-colors"
                      onClick={() => router.push(`/entities/${rel.target_id}`)}
                    >
                      {rel.target_name}
                    </span>
                  </div>
                ))}
                
                {entity.connections?.incoming?.map((rel: any, i: number) => (
                  <div key={`in-${i}`} className="flex items-center gap-4 p-3 rounded-xl bg-[#1a1a2e] border border-[#2a2a3e]">
                    <span 
                      className="text-sm font-medium text-white px-3 cursor-pointer hover:text-[#ff79c6] transition-colors"
                      onClick={() => router.push(`/entities/${rel.source_id}`)}
                    >
                      {rel.source_name}
                    </span>
                    <span className="text-xs font-mono text-[#ff79c6] bg-[#ff79c6]/10 px-2 py-1 rounded">--[{rel.type}]-&gt;</span>
                    <span className="text-sm font-medium text-white px-3">{entity.name}</span>
                  </div>
                ))}
                {(!entity.connections?.outgoing?.length && !entity.connections?.incoming?.length) && (
                  <div className="text-sm text-[#a0a0b0] text-center italic py-2">No relationships found</div>
                )}
              </div>
            </div>

            {/* Source Traceability */}
            <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#ff79c6]" />
                Source Traceability
              </h2>
              <div className="space-y-4">
                {entity.source_document_id && (
                  <div className="p-4 rounded-xl bg-[#1a1a2e] border border-[#2a2a3e]">
                    <div className="text-sm text-[#6b6b7b] mb-1">Origin Document</div>
                    <div 
                      className="text-[#ff79c6] font-medium cursor-pointer hover:underline flex items-center gap-2"
                      onClick={() => router.push(`/documents/${entity.source_document_id}`)}
                    >
                      <FileText className="w-4 h-4" />
                      View Original Document
                    </div>
                  </div>
                )}
                
                {entity.source_evidence && entity.source_evidence.length > 0 && (
                  <div className="p-4 rounded-xl bg-[#1a1a2e] border border-[#2a2a3e]">
                    <div className="text-sm text-[#6b6b7b] mb-3">Extracted Evidence Snippets</div>
                    <ul className="space-y-3">
                      {entity.source_evidence.map((evidence: string, i: number) => (
                        <li key={i} className="text-sm text-[#a0a0b0] pl-3 border-l-2 border-[#ff79c6]/50 italic">
                          "{evidence}"
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!entity.source_document_id && (!entity.source_evidence || entity.source_evidence.length === 0) && (
                  <div className="text-sm text-[#a0a0b0] text-center italic py-2">No source traceability data available for this entity.</div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-[#ff79c6]" />
                History
              </h2>
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-[#2a2a3e] before:to-transparent">
                {entity.modification_history?.slice().reverse().map((mod: any, i: number) => (
                  <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full border border-[#2a2a3e] bg-[#1a1a2e] text-[#a0a0b0] shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                      <Activity className="w-2.5 h-2.5" />
                    </div>
                    <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-xl bg-[#1a1a2e] border border-[#2a2a3e] shadow">
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium text-white text-sm capitalize">{mod.action}</div>
                        <time className="text-xs text-[#a0a0b0]">{new Date(mod.timestamp).toLocaleDateString()}</time>
                      </div>
                      {mod.fields && (
                        <div className="text-xs text-[#6b6b7b]">Updated: {mod.fields.join(', ')}</div>
                      )}
                    </div>
                  </div>
                ))}
                {(!entity.modification_history || entity.modification_history.length === 0) && (
                  <div className="text-sm text-[#a0a0b0] text-center italic py-2">No history available</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
