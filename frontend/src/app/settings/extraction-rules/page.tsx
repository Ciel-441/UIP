'use client';

import ClientOnly from '@/components/ClientOnly';
import React, { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { extractionRulesApi } from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { ShieldAlert, Trash2, Plus, BrainCircuit } from 'lucide-react';

interface ExtractionRule {
  id: number;
  rule_text: string;
  domain: string | null;
  is_active: boolean;
  created_at: string;
}

export default function ExtractionRulesPage() {
  const [rules, setRules] = useState<ExtractionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRuleText, setNewRuleText] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await extractionRulesApi.get();
      setRules(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleText.trim()) return;
    
    setAdding(true);
    try {
      await extractionRulesApi.create({ rule_text: newRuleText });
      setNewRuleText('');
      await fetchRules();
    } catch (error) {
      console.error(error);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    try {
      await extractionRulesApi.delete(id);
      setRules(rules.filter(r => r.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <AppShell>
      <ClientOnly>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ff79c6]/20 to-[#d68eff]/20 flex items-center justify-center border border-[#ff79c6]/30">
              <BrainCircuit className="w-5 h-5 text-[#ff79c6]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Extraction Rules</h1>
              <p className="text-sm text-[#6b6b7b]">Manage instructions injected into the AI's contextual reasoning.</p>
            </div>
          </div>

          {/* Add New Rule */}
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#ff79c6]" />
              New Instruction
            </h2>
            <form onSubmit={handleAddRule} className="flex gap-4">
              <div className="flex-1">
                <Input 
                  value={newRuleText}
                  onChange={(e) => setNewRuleText(e.target.value)}
                  placeholder="e.g., Never classify 'Water' as a toxic chemical..."
                  className="w-full"
                />
              </div>
              <Button type="submit" disabled={adding || !newRuleText.trim()}>
                {adding ? <Spinner size="sm" /> : <><Plus className="w-4 h-4 mr-2" /> Add Rule</>}
              </Button>
            </form>
          </div>

          {/* Active Rules List */}
          <div className="bg-[#13131a] border border-[#2a2a3e] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#2a2a3e] bg-[#1a1a24]">
              <h3 className="font-semibold text-white">Active Rules</h3>
            </div>
            
            {loading ? (
              <div className="p-8 flex justify-center">
                <Spinner size="lg" />
              </div>
            ) : rules.length === 0 ? (
              <div className="p-8 text-center text-[#6b6b7b]">
                No extraction rules defined yet.
              </div>
            ) : (
              <ul className="divide-y divide-[#2a2a3e]">
                {rules.map((rule) => (
                  <li key={rule.id} className="p-4 flex items-center justify-between hover:bg-[#1a1a24] transition-colors">
                    <div className="flex-1 mr-4">
                      <p className="text-sm text-white font-medium">{rule.rule_text}</p>
                      <p className="text-xs text-[#6b6b7b] mt-1">
                        Added on {new Date(rule.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-2 text-[#6b6b7b] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Delete Rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ClientOnly>
    </AppShell>
  );
}
