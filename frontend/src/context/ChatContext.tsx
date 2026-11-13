'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { aiApi } from '@/lib/api';
import { Citation } from '@/types';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  related_entities?: { name: string; type: string }[];
  follow_ups?: string[];
  confidence_score?: number;
  reasoning_chain?: string[];
  timestamp: Date;
}

export interface OllamaStatus {
  available: boolean;
  model?: string;
  error?: string;
}

interface ChatContextType {
  messages: Message[];
  isLoading: boolean;
  inputValue: string;
  setInputValue: (val: string) => void;
  sendMessage: (text?: string) => Promise<void>;
  clearChat: () => void;
  ollamaStatus: OllamaStatus | null;
  statusChecked: boolean;
  checkStatus: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const roomId = localStorage.getItem('active_room_id') || 'default';
      const stored = localStorage.getItem(`uip_chat_history_${roomId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      }
    } catch {
      // ignore
    }
    return [];
  });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await aiApi.status();
      const d = res.data;
      setOllamaStatus({
        available: d.ollama_available ?? d.available ?? false,
        model: d.model,
      });
    } catch {
      setOllamaStatus({ available: false, error: 'Cannot connect to AI backend' });
    } finally {
      setStatusChecked(true);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    try {
      const serialized = messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
      }));
      const roomId = localStorage.getItem('active_room_id') || 'default';
      localStorage.setItem(`uip_chat_history_${roomId}`, JSON.stringify(serialized));
    } catch {
      // ignore
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    const roomId = localStorage.getItem('active_room_id') || 'default';
    localStorage.removeItem(`uip_chat_history_${roomId}`);
  }, []);

  const sendMessage = useCallback(async (text?: string) => {
    const question = (text || inputValue).trim();
    if (!question || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await aiApi.query(question);
      const data = res.data;

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer || data.response || 'I received your question but could not generate a response.',
        citations: data.citations || [],
        related_entities: data.related_entities || [],
        follow_ups: data.follow_up_suggestions || data.follow_up_questions || data.follow_ups || [],
        confidence_score: data.confidence_score || 0.5,
        reasoning_chain: data.reasoning_chain || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I'm sorry, I encountered an error processing your request: ${err.response?.data?.detail || err.message || 'Unknown error'}. Please try again.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading]);

  return (
    <ChatContext.Provider value={{
      messages, isLoading, inputValue, setInputValue, sendMessage, clearChat, ollamaStatus, statusChecked, checkStatus
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
