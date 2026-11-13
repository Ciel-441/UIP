'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { FileText, ChevronLeft } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { documentApi } from '@/lib/api';

export default function DocumentDetails() {
  const { id } = useParams();
  const router = useRouter();
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const fetchDocument = async () => {
    try {
      const res = await documentApi.get(Number(id));
      setDoc(res.data);
    } catch (err) {
      console.error('Failed to fetch document', err);
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

  if (!doc) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <FileText className="w-12 h-12 text-[#6b6b7b]" />
          <h2 className="text-xl font-semibold text-white">Document Not Found</h2>
          <button onClick={() => router.back()} className="text-[#ff79c6] hover:underline">Go Back</button>
        </div>
      </AppShell>
    );
  }

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
          
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#12121a] border border-[#2a2a3e] flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#ff79c6]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{doc.original_name}</h1>
              <div className="flex items-center gap-3 mt-2 text-xs text-[#a0a0b0]">
                <span className="px-2 py-0.5 rounded-full bg-[#1a1a2e] border border-[#2a2a3e] uppercase tracking-wider">{doc.status}</span>
                {doc.created_at && <span>Uploaded on {new Date(doc.created_at).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-6 border-b border-[#2a2a3e] pb-4">Document Content</h2>
          <div className="prose prose-invert max-w-none text-[#a0a0b0] whitespace-pre-wrap font-mono text-sm leading-relaxed">
            {doc.content_text || "No text content available for this document."}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
