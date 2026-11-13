'use client';

import React, { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import ClientOnly from '@/components/ClientOnly';
import { FileText, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '@/lib/api';

export default function ReportsPage() {
  const [markdown, setMarkdown] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/reports/markdown')
      .then(res => {
        setMarkdown(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setMarkdown('# Error\nFailed to load report.');
        setLoading(false);
      });
  }, []);

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'intelligence_report.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ClientOnly>
      <AppShell>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10b981] to-[#047857] flex items-center justify-center shadow-lg shadow-[#10b981]/20">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                Intelligence Reports
              </h1>
              <p className="text-sm text-[#6b6b7b] mt-1 ml-[52px]">
                Export your Graph Discovery insights.
              </p>
            </div>
            <button
              onClick={handleDownload}
              disabled={loading}
              className="px-4 py-2 bg-[#ff79c6] hover:bg-[#ff92df] text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export Markdown
            </button>
          </div>

          <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl p-8 min-h-[500px]">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-[#ff79c6]/20 border-t-[#ff79c6] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="text-sm text-[#e2e8f0]">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-3xl font-bold text-white mt-8 mb-4 border-b border-[#2a2a3e] pb-2" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-2xl font-semibold text-white mt-8 mb-4" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-xl font-medium text-white mt-6 mb-3" {...props} />,
                    p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-2 marker:text-[#6b6b7b]" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-2 marker:text-[#6b6b7b]" {...props} />,
                    li: ({node, ...props}) => <li className="text-[#e2e8f0]" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-[#10b981]" {...props} />,
                    a: ({node, ...props}) => <a className="text-[#ff79c6] hover:underline" {...props} />,
                    hr: ({node, ...props}) => <hr className="border-[#2a2a3e] my-8" {...props} />,
                  }}
                >
                  {markdown}
                </ReactMarkdown>
              </div>
            )}

          </div>
        </div>
      </AppShell>
    </ClientOnly>
  );
}
