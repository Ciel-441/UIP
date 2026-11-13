import json
import logging
from app.services.ai_service import ask_ollama_json

logger = logging.getLogger(__name__)

class ImplementationPlannerAgent:
    """Translates an abstract strategy into a concrete implementation plan."""
    
    @staticmethod
    async def run(strategy: dict, twin_data: dict) -> dict:
        system_prompt = (
            "You are an Implementation Planning Agent. Given a selected strategy and digital twin data, "
            "generate a concrete project implementation plan.\n"
            "Return JSON with EXACTLY this schema:\n"
            "- tasks: list of objects { 'title': string, 'description': string, 'status': 'pending' }\n"
            "- dependencies: list of strings (requirements before starting)\n"
            "- timeline: string (e.g., '3 Months', 'Immediate')\n"
            "- resource_estimates: list of strings\n"
            "- success_metrics: list of strings\n"
        )
        user_prompt = (
            f"Strategy to Implement: {json.dumps(strategy)}\n"
            f"Target System (Twin): {json.dumps(twin_data)}\n"
        )
        
        result = await ask_ollama_json(system_prompt, user_prompt)
        
        return {
            "tasks": result.get("tasks", []),
            "dependencies": result.get("dependencies", []),
            "timeline": result.get("timeline", "Unknown"),
            "resource_estimates": result.get("resource_estimates", []),
            "success_metrics": result.get("success_metrics", [])
        }
