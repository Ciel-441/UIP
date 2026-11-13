'use client';

import React from 'react';
import Link from 'next/link';
import { SearchResult } from '@/types';
import { getEntityColor, getEntityBgColor, truncate } from '@/lib/utils';
import Badge from '@/components/ui/Badge';
import {
  Boxes,
  GitFork,
  FileText,
  ExternalLink,
} from 'lucide-react';

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'entity':
      return <Boxes className="w-4 h-4" />;
    case 'relationship':
      return <GitFork className="w-4 h-4" />;
    case 'document':
      return <FileText className="w-4 h-4" />;
    default:
      return <Boxes className="w-4 h-4" />;
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case 'entity':
      return '#ff79c6';
    case 'relationship':
      return '#d68eff';
    case 'document':
      return '#06b6d4';
    default:
      return '#ff79c6';
  }
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-[#ff79c6]/30 text-white rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function SearchResults({ results, query }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#1a1a2e] border border-[#2a2a3e] flex items-center justify-center mb-4">
          <Boxes className="w-7 h-7 text-[#6b6b7b]" />
        </div>
        <p className="text-white font-medium">No results found</p>
        <p className="text-sm text-[#6b6b7b] mt-1 max-w-sm">
          Try adjusting your search terms or filters to find what you&apos;re looking for
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#6b6b7b] mb-4">
        Found <span className="text-white font-medium">{results.length}</span> result{results.length !== 1 ? 's' : ''}
      </p>

      {results.map((result) => {
        const typeColor = getTypeColor(result.type);
        const getHref = () => {
          if (result.type === 'entity') return `/entities/${result.id}`;
          if (result.type === 'document') return `/documents/${result.id}`;
          return `/graph?focus=${result.id}`;
        };

        return (
          <Link href={getHref()} key={`${result.type}-${result.id}`}>
            <div
              className="group relative bg-[#12121a] border border-[#2a2a3e] rounded-xl p-5 hover:border-[#3a3a4e] hover:bg-[#1a1a2e]/50 transition-all duration-200 cursor-pointer"
            >
              <div className="flex items-start gap-4">
                {/* Type icon */}
                <div
                  className="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                  style={{
                    backgroundColor: `${typeColor}15`,
                    color: typeColor,
                  }}
                >
                  {getTypeIcon(result.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-white font-medium text-sm group-hover:text-[#ff92df] transition-colors">
                        {highlightMatch(result.name, query)}
                      </h3>
                      <p className="text-xs text-[#6b6b7b] mt-1 line-clamp-2">
                        {highlightMatch(truncate(result.description || '', 200), query)}
                      </p>
                    </div>

                    <ExternalLink className="w-4 h-4 text-[#6b6b7b] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-2 mt-3">
                    <Badge
                      variant="default"
                      className="text-[10px] uppercase tracking-wider"
                    >
                      {result.type}
                    </Badge>

                    {result.relevance > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-16 h-1.5 rounded-full bg-[#1a1a2e] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(result.relevance * 100, 100)}%`,
                              backgroundColor: typeColor,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-[#6b6b7b] font-mono">
                          {(result.relevance * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}

                    {result.source_document && (
                      <span className="text-[10px] text-[#6b6b7b] flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {result.source_document}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
