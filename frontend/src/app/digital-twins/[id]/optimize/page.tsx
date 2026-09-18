"use client";

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { twinsApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import { useDialog } from '@/context/DialogContext';

export default function GoalOptimizer() {
  const params = useParams();
  const { showToast } = useDialog();
  const twinId = parseInt(params.id as string);

  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState<any[]>([]);
  
  const [planning, setPlanning] = useState(false);
  const [implementationPlan, setImplementationPlan] = useState<any>(null);

  const handleOptimize = async () => {
    if (!goal) return;
    setLoading(true);
    setStrategies([]);
    setImplementationPlan(null);
    try {
      const res = await twinsApi.optimize(twinId, { goal, num_strategies: 3 });
      if (res.data && res.data.strategies) {
        setStrategies(res.data.strategies);
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to run Goal Optimizer", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStrategy = async (strategy: any) => {
    setPlanning(true);
    try {
      const res = await twinsApi.plan(twinId, strategy);
      setImplementationPlan(res.data);
    } catch (e) {
      console.error(e);
      showToast("Failed to generate implementation plan", "error");
    } finally {
      setPlanning(false);
    }
  };

  return (
    <AppShell>
      <div className="p-8 space-y-8 min-h-screen text-white">
        <header>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-secondary">
            Goal-Driven Optimizer
          </h1>
          <p className="text-gray-400 mt-2">Generate and compare optimal strategies for your Digital Twin.</p>
        </header>

        {/* Goal Input Section */}
        <div className="bg-bg-elevated border border-accent/30 p-6 rounded-lg">
          <label className="block text-sm font-medium text-gray-300 mb-2">Define Your Goal</label>
          <div className="flex space-x-4">
            <input 
              type="text" 
              className="flex-1 bg-black/50 border border-white/20 rounded-lg p-4 text-white focus:outline-none focus:border-accent"
              placeholder="e.g., Increase wheat yield while minimizing water consumption and cost."
              value={goal}
              onChange={e => setGoal(e.target.value)}
              disabled={loading || planning}
            />
            <button 
              onClick={handleOptimize}
              disabled={!goal || loading || planning}
              className={`px-8 py-4 rounded-lg font-bold transition-all ${(!goal || loading || planning) ? 'bg-accent/50 cursor-not-allowed text-white/50' : 'bg-accent hover:bg-accent-hover text-white'}`}
            >
              {loading ? 'Optimizing (approx. 45s)...' : 'Optimize Goal'}
            </button>
          </div>
        </div>

        {/* Strategy Comparison Center */}
        {strategies.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold border-b border-white/10 pb-2">Strategy Comparison Center</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {strategies.map((strat, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-lg p-6 flex flex-col relative overflow-hidden group hover:border-accent/50 transition-colors">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-accent-secondary"></div>
                  
                  <h3 className="text-xl font-bold text-accent-hover mb-2">{strat.name}</h3>
                  <div className="text-sm text-gray-400 mb-6 font-mono bg-black/30 p-2 rounded">
                    {JSON.stringify(strat.parameters)}
                  </div>

                  <div className="space-y-4 flex-1">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-black/40 p-2 rounded border border-white/5">
                        <span className="block text-gray-500 text-xs">Cost Estimate</span>
                        <span className="font-semibold">{strat.costs}</span>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-white/5">
                        <span className="block text-gray-500 text-xs">Sustainability</span>
                        <span className="font-semibold">{strat.sustainability}</span>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-white/5">
                        <span className="block text-gray-500 text-xs">Confidence</span>
                        <span className="font-semibold text-green-400">{(strat.confidence * 100).toFixed(1)}%</span>
                      </div>
                      <div className="bg-black/40 p-2 rounded border border-white/5">
                        <span className="block text-gray-500 text-xs">Resources</span>
                        <span className="font-semibold truncate block" title={strat.resource_requirements}>{strat.resource_requirements}</span>
                      </div>
                    </div>

                    {/* Lists */}
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Risks & Trade-offs</h4>
                      <ul className="text-sm space-y-1 list-disc pl-4 text-red-300/80">
                        {strat.risks?.slice(0,2).map((r: string, i: number) => <li key={i}>{r}</li>)}
                        {strat.trade_offs?.slice(0,2).map((t: string, i: number) => <li key={i}>{t}</li>)}
                        {(!strat.risks?.length && !strat.trade_offs?.length) && <li>None identified.</li>}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Expected Outcomes</h4>
                      <div className="text-sm bg-accent-secondary/10 p-2 rounded text-accent-secondary">
                        {JSON.stringify(strat.expected_outcomes)}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleSelectStrategy(strat)}
                    disabled={planning}
                    className="mt-6 w-full py-3 rounded bg-accent/20 text-accent hover:bg-accent hover:text-white border border-accent/50 transition-all font-semibold"
                  >
                    Select & Generate Plan
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Implementation Plan Rendering */}
        {planning && (
          <div className="p-8 text-center bg-accent-secondary/10 rounded-lg animate-pulse border border-accent-secondary/30">
            <h3 className="text-xl font-bold text-accent-secondary mb-2">Generating Implementation Plan...</h3>
            <p className="text-gray-400">Translating strategy into concrete real-world tasks and dependencies.</p>
          </div>
        )}

        {implementationPlan && !planning && (
          <div className="bg-green-900/10 border border-green-500/30 rounded-lg p-8 mt-8 space-y-6">
            <header className="border-b border-green-500/20 pb-4">
              <h2 className="text-2xl font-bold text-green-400">Implementation Plan</h2>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="bg-green-900/30 px-3 py-1 rounded-full text-green-300">Timeline: {implementationPlan.timeline}</span>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center"><span className="text-green-500 mr-2">📋</span> Required Tasks</h3>
                  <div className="space-y-3">
                    {implementationPlan.tasks?.map((task: any, idx: number) => (
                      <div key={idx} className="bg-black/40 p-4 rounded border border-white/5">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-gray-200">{task.title}</h4>
                          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded uppercase">{task.status}</span>
                        </div>
                        <p className="text-sm text-gray-400">{task.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center"><span className="text-yellow-500 mr-2">🔗</span> Dependencies</h3>
                  <ul className="list-disc pl-5 space-y-2 text-gray-300 text-sm bg-black/40 p-4 rounded border border-white/5">
                    {implementationPlan.dependencies?.map((dep: string, idx: number) => <li key={idx}>{dep}</li>)}
                    {!implementationPlan.dependencies?.length && <li>No strict dependencies.</li>}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center"><span className="text-accent mr-2">📦</span> Resource Estimates</h3>
                  <ul className="list-disc pl-5 space-y-2 text-gray-300 text-sm bg-black/40 p-4 rounded border border-white/5">
                    {implementationPlan.resource_estimates?.map((res: string, idx: number) => <li key={idx}>{res}</li>)}
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center"><span className="text-purple-500 mr-2">🎯</span> Success Metrics</h3>
                  <ul className="list-disc pl-5 space-y-2 text-gray-300 text-sm bg-black/40 p-4 rounded border border-white/5">
                    {implementationPlan.success_metrics?.map((metric: string, idx: number) => <li key={idx}>{metric}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
