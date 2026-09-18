'use client';

import ClientOnly from '@/components/ClientOnly';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Bot, User, AlertTriangle, Sparkles, BookOpen,
  ExternalLink, ChevronRight, RefreshCw, Loader2, Copy,
  Check, MessageSquare, Zap, Search, FileText, Link2,
  CheckCircle2, XCircle, Trash2
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { cn, getEntityColor, getEntityBgColor } from '@/lib/utils';
import { aiApi } from '@/lib/api';
import { Citation } from '@/types';
import { useChat, Message, OllamaStatus } from '@/context/ChatContext';



/* ─── Typing Indicator ───────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff79c6]/20 to-[#d68eff]/20 border border-[#ff79c6]/30 flex items-center justify-center shrink-0">
        <Bot className="w-4 h-4 text-[#ff79c6]" />
      </div>
      <div className="bg-[#12121a] border border-[#2a2a3e] rounded-2xl rounded-tl-md px-5 py-4">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#ff79c6] animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-[#ff79c6] animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-[#ff79c6] animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────────────────── */
const MessageBubble = React.memo(function MessageBubble({
  message,
  onFollowUp,
}: {
  message: Message;
  onFollowUp?: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex gap-3 animate-slide-up', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-xl flex items-center justify-center shrink-0',
        isUser
          ? 'bg-gradient-to-br from-[#ff79c6] to-[#ff92df]'
          : 'bg-gradient-to-br from-[#ff79c6]/20 to-[#d68eff]/20 border border-[#ff79c6]/30'
      )}>
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-[#ff79c6]" />}
      </div>

      <div className={cn('max-w-[75%] space-y-3', isUser && 'items-end')}>
        {/* Message content */}
        <div className={cn(
          'rounded-2xl px-5 py-3.5 text-sm relative group',
          isUser
            ? 'bg-gradient-to-br from-[#ff79c6] to-[#ff92df] text-white rounded-tr-md shadow-lg shadow-[#ff79c6]/10'
            : 'bg-[#12121a] border border-[#2a2a3e] text-[#a0a0b0] rounded-tl-md'
        )}>
          <div className="space-y-1">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({node, ...props}) => <p className="leading-relaxed mb-2 last:mb-0" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-2 space-y-1" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-2 space-y-1" {...props} />,
                li: ({node, ...props}) => <li className="pl-1" {...props} />,
                strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                em: ({node, ...props}) => <em className="italic text-white/80" {...props} />,
                h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mt-4 mb-2" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-lg font-semibold text-white mt-4 mb-2" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-base font-semibold text-white mt-3 mb-2" {...props} />,
                code: ({node, inline, ...props}: any) => 
                  inline 
                    ? <code className="px-1.5 py-0.5 bg-[#1a1a2e] rounded text-[#ff79c6] text-xs font-mono" {...props} />
                    : <code className="block p-3 bg-[#1a1a2e] rounded-lg text-xs font-mono overflow-x-auto mb-2 text-[#ff79c6]" {...props} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Copy button for assistant messages */}
          {!isUser && (
            <button
              onClick={handleCopy}
              className="absolute -bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-[#1a1a2e] border border-[#2a2a3e] hover:border-[#3a3a4e]"
            >
              {copied ? (
                <Check className="w-3 h-3 text-[#10b981]" />
              ) : (
                <Copy className="w-3 h-3 text-[#6b6b7b]" />
              )}
            </button>
          )}
        </div>

        {/* AI Reasoning / Confidence Badge */}
        {!isUser && message.confidence_score !== undefined && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#12121a] border border-[#2a2a3e] w-fit">
            <Zap className={cn("w-3.5 h-3.5", message.confidence_score > 0.8 ? "text-[#10b981]" : message.confidence_score > 0.5 ? "text-[#f59e0b]" : "text-[#ef4444]")} />
            <span className="text-xs font-medium text-[#a0a0b0]">
              Confidence: {Math.round(message.confidence_score * 100)}%
            </span>
          </div>
        )}

        {/* Citations */}
        {!isUser && message.citations && message.citations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3 h-3 text-[#6b6b7b]" />
              <span className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-medium">Citations</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.citations.map((citation, i) => (
                <button
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#12121a] border border-[#2a2a3e] hover:border-[#ff79c6]/50 transition-all text-xs group/cite"
                >
                  {citation.entity_id ? (
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getEntityColor(citation.type) }} />
                  ) : (
                    <FileText className="w-3 h-3 text-[#6b6b7b]" />
                  )}
                  <span className="text-[#a0a0b0] group-hover/cite:text-white transition-colors">{citation.name}</span>
                  <ExternalLink className="w-2.5 h-2.5 text-[#6b6b7b] opacity-0 group-hover/cite:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Related entities */}
        {!isUser && message.related_entities && message.related_entities.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Link2 className="w-3 h-3 text-[#6b6b7b]" />
              <span className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-medium">Related Entities</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {message.related_entities.map((entity, i) => {
                const color = getEntityColor(entity.type);
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}33` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {entity.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Follow-up suggestions */}
        {!isUser && message.follow_ups && message.follow_ups.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#6b6b7b]" />
              <span className="text-[10px] text-[#6b6b7b] uppercase tracking-wider font-medium">Follow-up Questions</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {message.follow_ups.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUp?.(suggestion)}
                  className="text-left px-3.5 py-2.5 rounded-xl bg-[#12121a] border border-[#2a2a3e] hover:border-[#ff79c6]/50 hover:bg-white/[0.02] transition-all text-xs text-[#a0a0b0] hover:text-white group/follow flex items-center gap-2"
                >
                  <ChevronRight className="w-3 h-3 text-[#ff79c6] opacity-50 group-hover/follow:opacity-100 transition-opacity" />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reasoning Visualization (AI Thought Process) */}
        {!isUser && message.reasoning_chain && message.reasoning_chain.length > 0 && (
          <details className="group/reasoning">
            <summary className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#12121a] border border-[#2a2a3e] hover:border-[#ff79c6]/50 transition-all text-xs text-[#a0a0b0] cursor-pointer w-fit list-none select-none">
              <Zap className="w-3.5 h-3.5 text-[#ff79c6]" />
              <span className="font-medium">Show AI Thought Process</span>
              <ChevronRight className="w-3 h-3 transition-transform group-open/reasoning:rotate-90 ml-1" />
            </summary>
            <div className="mt-2 p-3 rounded-xl bg-[#12121a] border border-[#2a2a3e] text-xs text-[#6b6b7b] font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
              {message.reasoning_chain.map((step, i) => (
                <div key={i} className="mb-2 last:mb-0 pb-2 last:pb-0 border-b border-[#2a2a3e] last:border-0">
                  <span className="text-[#ff79c6] opacity-70 mr-2">[{i + 1}]</span>
                  {step}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
});

/* ─── Main Assistant Page ────────────────────────────────────── */
export default function AssistantPage() {
  const { 
    messages, isLoading, inputValue, setInputValue, sendMessage, clearChat, 
    ollamaStatus, statusChecked, checkStatus 
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Auto-scroll ─────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  /* ── Follow-up handler ───────────────────────────────────── */
  const handleFollowUp = useCallback((text: string) => {
    setInputValue(text);
    inputRef.current?.focus();
  }, [setInputValue]);

  /* ── Keyboard handler ────────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ── Suggestions ─────────────────────────────────────────── */
  const suggestions = [
    'What diseases commonly affect rice crops?',
    'How does nitrogen impact soil health?',
    'What are the relationships between climate and crop yield?',
    'Summarize the key entities in my knowledge graph',
  ];

  return (
    <ClientOnly>
    <AppShell>
      <div className="h-[calc(100vh-88px)] flex flex-col -m-6 animate-fade-in">
        {/* Ollama status warning */}
        {statusChecked && ollamaStatus && !ollamaStatus.available && (
          <div className="mx-6 mt-6 p-3.5 rounded-xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center gap-3 animate-slide-up">
            <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#f59e0b]">AI Backend Unavailable</p>
              <p className="text-xs text-[#f59e0b]/70">{ollamaStatus.error || 'Ollama is not running. Please start Ollama to use the AI assistant.'}</p>
            </div>
            <button
              onClick={checkStatus}
              className="p-2 rounded-lg hover:bg-[#f59e0b]/10 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-[#f59e0b]" />
            </button>
          </div>
        )}

        {/* Status pill when connected */}
        {statusChecked && ollamaStatus?.available && (
          <div className="flex items-center justify-center pt-4 gap-2">
            <div className="glass rounded-full px-4 py-1.5 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse" />
              <span className="text-[10px] text-[#6b6b7b] uppercase tracking-wider">AI Connected</span>
              {ollamaStatus.model && (
                <>
                  <div className="w-px h-3 bg-[#2a2a3e]" />
                  <span className="text-[10px] text-[#a0a0b0]">{ollamaStatus.model}</span>
                </>
              )}
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="glass rounded-full px-3 py-1.5 flex items-center gap-1.5 hover:bg-red-500/10 hover:border-red-500/30 transition-all group"
                title="Clear chat history"
              >
                <Trash2 className="w-3 h-3 text-[#6b6b7b] group-hover:text-red-400 transition-colors" />
                <span className="text-[10px] text-[#6b6b7b] group-hover:text-red-400 uppercase tracking-wider transition-colors">Clear Chat</span>
              </button>
            )}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {messages.length === 0 ? (
            /* Empty state */
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-lg">
                <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[#ff79c6]/20 to-[#d68eff]/20 border border-[#ff79c6]/20 flex items-center justify-center mb-6">
                  <Sparkles className="w-10 h-10 text-[#ff79c6]" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">AI Knowledge Assistant</h2>
                <p className="text-sm text-[#6b6b7b] mb-8">
                  Ask questions about your knowledge graph. I can help you explore entities,
                  relationships, and insights from your data.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s)}
                      className="text-left p-3.5 rounded-xl bg-[#12121a] border border-[#2a2a3e] hover:border-[#ff79c6]/50 hover:bg-white/[0.02] transition-all text-xs text-[#a0a0b0] hover:text-white group"
                    >
                      <div className="flex items-start gap-2">
                        <Search className="w-3.5 h-3.5 text-[#ff79c6] mt-0.5 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                        <span>{s}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Message list */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} onFollowUp={handleFollowUp} />
              ))}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="border-t border-[#2a2a3e] bg-[#0a0a0f]/80 backdrop-blur-md px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about your knowledge graph..."
                  className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-xl px-5 py-3.5 text-sm text-white placeholder-[#6b6b7b] focus:outline-none focus:border-[#ff79c6] focus:ring-1 focus:ring-[#ff79c6]/30 hover:border-[#3a3a4e] transition-all pr-12"
                  disabled={isLoading}
                />
                {inputValue.trim() && (
                  <button
                    onClick={() => setInputValue('')}
                    className="absolute right-12 top-1/2 -translate-y-1/2 p-1 rounded text-[#6b6b7b] hover:text-white transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => sendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0',
                  inputValue.trim() && !isLoading
                    ? 'bg-gradient-to-br from-[#ff79c6] to-[#ff92df] text-white shadow-lg shadow-[#ff79c6]/20 hover:shadow-[#ff79c6]/30 hover:scale-105'
                    : 'bg-[#1a1a2e] text-[#6b6b7b] cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-center text-[10px] text-[#6b6b7b]/50 mt-2">
              AI responses are generated from your knowledge graph data
            </p>
          </div>
        </div>
      </div>
    </AppShell>
    </ClientOnly>
  );
}
