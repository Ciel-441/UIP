import json
import logging
from app.services.ai_service import ask_ollama_json

logger = logging.getLogger(__name__)

class ForecastAgent:
    """Predicts future metric states based on current graph data."""
    
    @staticmethod
    async def run(twin_data: dict, target_metric: str, timeframe_days: int) -> dict:
        system_prompt = (
            "You are a predictive Forecasting Agent. Given the state of a digital twin, "
            "predict the outcome for the target metric over the given timeframe.\n\n"
            "CRITICAL: Predictions must never be presented as facts. They are estimates. "
            "You MUST output JSON with exactly these keys:\n"
            "- predicted_value (string)\n"
            "- confidence (float 0.0 to 1.0)\n"
            "- assumptions (list of strings)\n"
            "- evidence (list of strings)\n"
            "- data_coverage (float 0.0 to 1.0)\n"
        )
        user_prompt = (
            f"Digital Twin State: {json.dumps(twin_data)}\n"
            f"Target Metric: {target_metric}\n"
            f"Timeframe: {timeframe_days} days\n"
        )
        
        result = await ask_ollama_json(system_prompt, user_prompt)
        
        # Enforce defaults in case the LLM fails to provide them
        return {
            "predicted_value": result.get("predicted_value", "Unknown"),
            "confidence": float(result.get("confidence", 0.1)),
            "assumptions": result.get("assumptions", ["Insufficient data to form assumptions."]),
            "evidence": result.get("evidence", ["Model speculation."]),
            "data_coverage": float(result.get("data_coverage", 0.0)),
        }

class SimulationAgent:
    """Simulates \"What If\" parameter changes and their downstream effects."""
    
    @staticmethod
    async def run(twin_data: dict, scenario_parameters: dict) -> dict:
        system_prompt = (
            "You are a Simulation Agent. Given a baseline system and new parameter interventions, "
            "simulate the downstream effects. Return a JSON object containing:\n"
            "- impact_chains: A list of objects { 'cause': '...', 'effect': '...', 'magnitude': 'high|medium|low' }\n"
            "- predicted_state: A dictionary of new system metrics\n"
            "- confidence: float (0.0 to 1.0)"
        )
        user_prompt = (
            f"Baseline System: {json.dumps(twin_data)}\n"
            f"Scenario Interventions: {json.dumps(scenario_parameters)}\n"
        )
        
        result = await ask_ollama_json(system_prompt, user_prompt)
        return {
            "impact_chains": result.get("impact_chains", []),
            "predicted_state": result.get("predicted_state", {}),
            "confidence": float(result.get("confidence", 0.1)),
        }

class RiskAgent:
    """Scans for high-risk causal chains or vulnerabilities."""
    
    @staticmethod
    async def run(twin_data: dict) -> dict:
        system_prompt = (
            "You are a Risk Analysis Agent. Identify single points of failure, emerging threats, "
            "or fragile sub-systems in the provided system data. Return JSON with:\n"
            "- risks: A list of objects { 'risk_type': '...', 'description': '...', 'score': float 0.0 to 1.0 }\n"
        )
        user_prompt = f"System Data: {json.dumps(twin_data)}\n"
        
        result = await ask_ollama_json(system_prompt, user_prompt)
        return {"risks": result.get("risks", [])}

class StrategyAgent:
    """Compares simulations and recommends actions."""
    
    @staticmethod
    async def run(goal: str, simulation_results: list) -> dict:
        system_prompt = (
            "You are a Decision Support Strategy Agent. Compare the provided scenario simulation "
            "outcomes against the primary goal, and recommend a strategy. Return JSON with:\n"
            "- recommended_actions (list of strings)\n"
            "- predicted_impact (dict)\n"
            "- trade_offs (list of strings)\n"
            "- confidence (float 0.0 to 1.0)"
        )
        user_prompt = (
            f"Goal: {goal}\n"
            f"Simulation Results: {json.dumps(simulation_results)}\n"
        )
        
        result = await ask_ollama_json(system_prompt, user_prompt)
        return {
            "recommended_actions": result.get("recommended_actions", []),
            "predicted_impact": result.get("predicted_impact", {}),
            "trade_offs": result.get("trade_offs", []),
            "confidence": float(result.get("confidence", 0.1)),
        }

class AlternativeGeneratorAgent:
    """Generates alternative parameter scenarios to achieve a goal."""
    
    @staticmethod
    async def run(goal: str, twin_data: dict, count: int) -> list:
        system_prompt = (
            f"You are a Strategy Generator. Given a digital twin and a goal, invent {count} distinct "
            "parameter interventions (scenarios) that attempt to achieve the goal.\n"
            "Return JSON with exactly:\n"
            "- scenarios: list of dicts, each containing:\n"
            "  - name: string (A short title for the strategy)\n"
            "  - parameters: dict of parameter changes\n"
        )
        user_prompt = f"Goal: {goal}\nBaseline Twin: {json.dumps(twin_data)}\n"
        
        result = await ask_ollama_json(system_prompt, user_prompt)
        return result.get("scenarios", [])[:count]

class UnifiedFutureModelingOrchestrator:
    """Coordinates prediction, simulation, and risk analysis."""
    
    @staticmethod
    async def execute_full_pipeline(twin_data: dict, scenario_parameters: dict, goal: str = "Optimize system health") -> dict:
        # 1. Run Risk Analysis on Baseline
        risks = await RiskAgent.run(twin_data)
        
        # 2. Run Simulation for the Scenario
        simulation = await SimulationAgent.run(twin_data, scenario_parameters)
        
        # 3. Generate a Strategy based on the simulation
        strategy = await StrategyAgent.run(goal, [simulation])
        
        # 4. Forecast a key metric (e.g., 'system_health')
        forecast = await ForecastAgent.run(twin_data, "system_health", 30)
        
        return {
            "risks": risks,
            "simulation": simulation,
            "strategy": strategy,
            "forecast": forecast
        }

    @staticmethod
    async def solve_for_goal(goal: str, twin_data: dict, num_strategies: int = 3) -> dict:
        """Solves for a goal by generating and evaluating multiple alternative strategies."""
        # 1. Generate alternative scenarios
        scenarios = await AlternativeGeneratorAgent.run(goal, twin_data, num_strategies)
        if not scenarios:
            # Fallback if generation fails
            scenarios = [{"name": "Default Intervention", "parameters": {}}]
            
        results = []
        for scenario in scenarios:
            # Run Simulation
            sim = await SimulationAgent.run(twin_data, scenario.get("parameters", {}))
            
            # Evaluate against schema constraints
            system_prompt = (
                "You are an Evaluator Agent. Given a proposed scenario and its simulation results, "
                "evaluate the strategy against the goal and return EXACTLY this JSON schema:\n"
                "- expected_outcomes: dict\n"
                "- costs: string (qualitative, e.g., 'High', 'Moderate')\n"
                "- sustainability: string (qualitative)\n"
                "- resource_requirements: string (qualitative)\n"
                "- evidence: list of strings\n"
                "- assumptions: list of strings\n"
                "- confidence: float 0.0-1.0\n"
                "- risks: list of strings\n"
                "- trade_offs: list of strings\n"
            )
            user_prompt = (
                f"Goal: {goal}\n"
                f"Scenario Name: {scenario.get('name', 'Unnamed')}\n"
                f"Scenario Parameters: {json.dumps(scenario.get('parameters', {}))}\n"
                f"Simulation Impact: {json.dumps(sim)}\n"
            )
            eval_res = await ask_ollama_json(system_prompt, user_prompt)
            
            eval_res["name"] = scenario.get("name", "Unnamed Strategy")
            eval_res["parameters"] = scenario.get("parameters", {})
            
            # Enforce defaults
            eval_res.setdefault("expected_outcomes", sim.get("predicted_state", {}))
            eval_res.setdefault("costs", "Unknown")
            eval_res.setdefault("sustainability", "Unknown")
            eval_res.setdefault("resource_requirements", "Unknown")
            eval_res.setdefault("evidence", ["Simulated graph traversal"])
            eval_res.setdefault("assumptions", ["Model constraints apply"])
            eval_res.setdefault("confidence", 0.5)
            eval_res.setdefault("risks", [])
            eval_res.setdefault("trade_offs", [])
            
            results.append(eval_res)
            
        return {
            "goal": goal,
            "strategies": results
        }

