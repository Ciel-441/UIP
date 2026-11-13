'use client';

import ClientOnly from '@/components/ClientOnly';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import SearchResults from '@/components/search/SearchResults';
import { searchApi } from '@/lib/api';
import { SearchResult } from '@/types';
import Spinner from '@/components/ui/Spinner';
import { Search as SearchIcon, Boxes, GitFork, FileText, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { key: '', label: 'All', icon: <Layers className="w-4 h-4" /> },
  { key: 'entity', label: 'Entities', icon: <Boxes className="w-4 h-4" /> },
  { key: 'relationship', label: 'Relationships', icon: <GitFork className="w-4 h-4" /> },
  { key: 'document', label: 'Documents', icon: <FileText className="w-4 h-4" /> },
];

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const performSearch = useCallback(async (q: string, type: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const params: { q: string; type?: string } = { q };
      if (type) params.type = type;
      const res = await searchApi.search(params);
      const data = res.data;
      setResults(data.results || data || []);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      performSearch(query, activeTab);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeTab, performSearch]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <ClientOnly>
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Search</h1>
          <p className="text-sm text-[#6b6b7b] mt-1">Search across entities, relationships, and documents</p>
        </div>

        {/* Search Input */}
        <div className="relative group">
          <div className="absolute -inset-[1px] bg-gradient-to-r from-[#ff79c6]/30 via-[#d68eff]/20 to-[#ff79c6]/30 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 blur-[1px]" />
          <div className="relative flex items-center bg-[#12121a] border border-[#2a2a3e] rounded-2xl group-focus-within:border-[#ff79c6]/50 transition-colors duration-300">
            <SearchIcon className="w-5 h-5 text-[#6b6b7b] ml-5 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search for entities, relationships, documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-white placeholder-[#6b6b7b] px-4 py-4 text-base focus:outline-none"
              id="search-input"
            />
            {loading && (
              <div className="mr-4">
                <Spinner size="sm" />
              </div>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                activeTab === tab.key
                  ? 'bg-[#ff79c6]/15 text-[#ff92df] border border-[#ff79c6]/30'
                  : 'bg-[#12121a] text-[#6b6b7b] border border-[#2a2a3e] hover:text-[#a0a0b0] hover:border-[#3a3a4e]'
              )}
              id={`search-tab-${tab.key || 'all'}`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#ff79c6]/10 to-[#d68eff]/10 border border-[#2a2a3e] flex items-center justify-center">
                <SearchIcon className="w-8 h-8 text-[#6b6b7b]" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff79c6] rounded-full animate-pulse" />
            </div>
            <p className="text-white font-medium text-lg">Start Searching</p>
            <p className="text-sm text-[#6b6b7b] mt-2 max-w-sm">
              Type in the search bar above to find entities, relationships, and documents in your knowledge base
            </p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : (
          <SearchResults results={results} query={query} />
        )}
      </div>
    </AppShell>
    </ClientOnly>
  );
}
