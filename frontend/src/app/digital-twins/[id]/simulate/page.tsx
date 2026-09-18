"use client";

import { useEffect, useState } from 'react';
import { twinsApi } from '@/lib/api';
import { useParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { useDialog } from '@/context/DialogContext';

export default function ScenarioSimulation() {
  const params = useParams();
  const { showToast } = useDialog();
  const [twin, setTwin] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Scenario input state
  const [title, setTitle] = useState("Drought Scenario");
  const [desc, setDesc] = useState("Decrease rainfall by 20%");
  const [paramsInput, setParamsInput] = useState("{\n  \"rainfall_modifier\": -0.2\n}");

  useEffect(() => {
    if (!params?.id) return;
    
    // Add a cache buster parameter to prevent the browser from serving a cached empty array
    twinsApi.list({ timestamp: new Date().getTime() }).then(res => {
      console.log("twinsApi.list() response:", res.data);
      const found = res.data.find((t: any) => t.id === parseInt(params.id as string) || t.id == params.id);
      setTwin(found);
      setLoading(false);
    }).catch(err => {
      console.error("Failed to load twins:", err);
      setTwin(null);
      setLoading(false);
    });
  }, [params?.id]);

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      // 1. Create the scenario
      const parsedParams = JSON.parse(paramsInput);
      const scenarioRes = await twinsApi.createScenario(parseInt(params.id as string), {
        title,
        description: desc,
        parameters: parsedParams
      });
      const scenarioId = scenarioRes.data.id;

      // 2. Run simulation
      const simRes = await twinsApi.simulate(parseInt(params.id as string), scenarioId);
      setResults(simRes.data.results);
    } catch (e) {
      console.error("Simulation failed", e);
      showToast("Simulation failed. Check console.", "error");
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-8 text-white">Loading Twin...</div>
      </AppShell>
    );
  }
  
  if (!twin) {
    return (
      <AppShell>
        <div className="p-8 text-red-400">Twin not found</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-8 space-y-8 min-h-screen text-white">
        <header className="border-b border-white/10 pb-4">
          <div className="flex items-center space-x-4 mb-2">
            <a href="/digital-twins" className="text-gray-400 hover:text-white">← Back to Digital Twins</a>
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent-secondary">
            Simulation Engine
          </h1>
          <p className="text-gray-400 mt-2">Running scenarios against Digital Twin: <span className="text-white font-medium">{twin.name}</span></p>
        </header>

        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 mb-8">
          <h3 className="text-yellow-500 font-bold">PREDICTIVE DISCLAIMER</h3>
          <p className="text-yellow-200/80 mt-1 text-sm">
            Simulations are estimates based on existing graph connections and causal modeling. They do not represent absolute truths.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Scenario Configuration */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Configure Intervention</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Scenario Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black border border-white/20 rounded p-2 text-white" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)} className="w-full bg-black border border-white/20 rounded p-2 text-white" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Parameters (JSON)</label>
              <textarea 
                value={paramsInput} 
                onChange={e => setParamsInput(e.target.value)} 
                className="w-full bg-black border border-white/20 rounded p-2 text-white font-mono text-sm h-32" 
              />
            </div>

            <button 
              onClick={handleSimulate}
              disabled={simulating}
              className={`w-full py-3 rounded font-medium ${simulating ? 'bg-accent/50 cursor-not-allowed' : 'bg-accent hover:bg-accent-hover'} transition-colors`}
            >
              {simulating ? 'Running Neural Simulation...' : 'Execute Scenario Simulation'}
            </button>
          </div>

          {/* Results */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Simulation Outcomes</h2>
            
            {!results ? (
              <div className="h-64 flex items-center justify-center text-gray-500">
                Configure a scenario and run a simulation to see predicted outcomes.
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Forecasted Target Metric */}
                {results.forecast && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/30 p-4 rounded border border-white/5">
                      <div className="text-sm text-gray-400">Target Metric Forecast</div>
                      <div className="text-2xl font-bold text-accent">{results.forecast.predicted_value}</div>
                      <div className="text-xs text-gray-500 mt-1">Confidence: {(results.forecast.confidence * 100).toFixed(1)}%</div>
                    </div>
                    <div className="p-4 rounded border bg-accent-secondary/5 border-accent-secondary/20 text-accent-secondary">
                      <div className="text-sm opacity-80">Data Coverage</div>
                      <div className="text-2xl font-bold">{(results.forecast.data_coverage * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                )}

                {/* Strategy Output */}
                {results.strategy && (
                  <div className="bg-purple-900/20 border border-purple-500/30 rounded p-4">
                    <h3 className="text-purple-300 font-semibold mb-2">Strategy Recommendations</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-gray-300">
                      {results.strategy.recommended_actions?.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                    <div className="mt-2 text-xs text-purple-400/80">Strategy Confidence: {(results.strategy.confidence * 100).toFixed(0)}%</div>
                  </div>
                )}

                {/* Simulation Impact Chains */}
                {results.simulation && results.simulation.impact_chains && (
                  <div>
                    <h3 className="font-semibold text-accent mb-2">Predicted Causal Impacts</h3>
                    <div className="space-y-2">
                      {results.simulation.impact_chains.map((chain: any, i: number) => (
                        <div key={i} className="bg-black/40 p-3 rounded text-sm flex items-center justify-between border border-white/5">
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-400">{chain.cause}</span>
                            <span className="text-accent">→</span>
                            <span className="font-medium">{chain.effect}</span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded ${
                            chain.magnitude === 'high' ? 'bg-red-900/50 text-red-300' : 
                            chain.magnitude === 'medium' ? 'bg-yellow-900/50 text-yellow-300' : 'bg-green-900/50 text-green-300'
                          }`}>
                            {chain.magnitude} impact
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </AppShell>
  );
}
