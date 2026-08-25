import json
import logging
import os
from typing import Any, Dict

import openai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Setup basic logging for the agent's operations
logger = logging.getLogger("aegis.swarm")
logging.basicConfig(level=logging.INFO)

# -----------------------------------------------------------------------------
# 1. Models and Schemas
# -----------------------------------------------------------------------------

class TriageRequest(BaseModel):
    raw_text: str = Field(min_length=1, description="Unstructured crisis report text (Telegram, Logs, SMS)")

class TriageResponse(BaseModel):
    incident_type: str = Field(description="Natural_Disaster, Terrorism_Attack, or 'Requires Human Audit'")
    disaster_type: str = Field(description="Specific sub-category (e.g., Explosion, Flood, Unverified)")
    urgency_score: int = Field(ge=1, le=5, description="1-5 scale based on immediate threat to life")
    financial_target_usd: float = Field(ge=0, description="Estimated emergency funding needed")
    location_mentions: list[str] = Field(description="List of detected locations")
    classification_source: str = Field(default="osint_swarm")

# -----------------------------------------------------------------------------
# 2. Tool (Function) Definitions
# -----------------------------------------------------------------------------

def search_local_news(query: str, location: str) -> str:
    """Mock API call to search for recent news regarding an event."""
    logger.info(f"Executing search_local_news(query={query!r}, location={location!r})")
    # In a real environment, integrate DuckDuckGo, Tavily, or SerpApi here.
    query_lower = query.lower()
    if "bomb" in query_lower or "explosion" in query_lower or "attack" in query_lower:
        return f"Recent news in {location}: Verified reports of an explosion in the city center within the last hour. Emergency services are on scene."
    if "flood" in query_lower or "water" in query_lower:
        return f"Recent news in {location}: Local news reports heavy flooding and road closures."
    
    return f"No corroborating recent news found for '{query}' in {location} over the last 3 hours."

def check_weather_anomaly(latitude: float, longitude: float) -> str:
    """Mock API call to verify natural disasters like floods or storms via coordinates."""
    logger.info(f"Executing check_weather_anomaly(lat={latitude}, lon={longitude})")
    # In a real environment, integrate OpenWeather API here.
    if latitude > 0 and longitude > 0:
        return f"Weather Station Data at {latitude}, {longitude}: Extreme rainfall and severe thunderstorm warnings active."
    return f"Normal weather conditions reported at {latitude}, {longitude}."

# Map the function names to the actual Python functions
AVAILABLE_TOOLS = {
    "search_local_news": search_local_news,
    "check_weather_anomaly": check_weather_anomaly
}

# The JSON schema describing the tools to the OpenAI model
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_local_news",
            "description": "Searches for recent local news regarding an event to corroborate a crisis report.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query (e.g., 'explosion', 'flood', 'gunfire')"},
                    "location": {"type": "string", "description": "The location to search around (e.g., 'Kyiv', 'Miami')"}
                },
                "required": ["query", "location"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_weather_anomaly",
            "description": "Checks for weather anomalies like storms or floods at specific coordinates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "latitude": {"type": "number", "description": "Latitude of the location"},
                    "longitude": {"type": "number", "description": "Longitude of the location"}
                },
                "required": ["latitude", "longitude"]
            }
        }
    }
]

# -----------------------------------------------------------------------------
# 3. Agent Orchestrator (Supervisor Loop)
# -----------------------------------------------------------------------------

SYSTEM_PROMPT = """You are the Aegis Supervisor Agent. You receive raw crisis reports. 
Before assigning an Urgency Score or routing funds, you MUST use the provided search or weather tools to look for corroborating evidence from the last 3 hours. 
If you cannot verify the event via tools, you must downgrade the status to 'Requires Human Audit' with Urgency Score 1 and 0 funds.
Output your final response using the required structured output schema."""

# Initialize FastAPI Router (can be mounted in main.py)
router = APIRouter()

@router.post("/verify", response_model=TriageResponse)
def swarm_verify_endpoint(request: TriageRequest) -> TriageResponse:
    # Initialize the OpenAI Client (requires OPENAI_API_KEY environment variable)
    client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Please verify and triage the following raw report:\n\n{request.raw_text}"}
    ]
    
    max_steps = 5  # Prevent infinite loops
    
    for step in range(max_steps):
        logger.info(f"Agent Loop Step: {step + 1}/{max_steps}")
        try:
            # We use the beta.chat.completions.parse method to enforce structured outputs 
            # based on our TriageResponse Pydantic model.
            response = client.beta.chat.completions.parse(
                model="gpt-4o-mini",
                messages=messages,
                tools=TOOLS_SCHEMA,
                response_format=TriageResponse,
            )
        except Exception as e:
            logger.error(f"OpenAI API Error: {e}")
            raise HTTPException(status_code=500, detail="Error communicating with LLM.")
            
        message = response.choices[0].message
        
        # 1. Did the agent decide to call a tool?
        if message.tool_calls:
            # Append the assistant's tool call message back to the conversation
            messages.append(message)
            
            # Execute each requested tool in the loop
            for tool_call in message.tool_calls:
                func_name = tool_call.function.name
                func_args_str = tool_call.function.arguments
                
                try:
                    func_args = json.loads(func_args_str)
                    
                    if func_name in AVAILABLE_TOOLS:
                        tool_func = AVAILABLE_TOOLS[func_name]
                        tool_result = tool_func(**func_args)
                    else:
                        tool_result = f"Error: Tool '{func_name}' is not recognized."
                except Exception as e:
                    # Graceful degradation: If a tool fails to parse or run, inform the agent
                    logger.error(f"Error executing {func_name}: {e}")
                    tool_result = f"Error executing tool: {str(e)}. Proceed to evaluate based on this failure or try again."
                
                # Append the tool's output back to the conversation
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(tool_result)
                })
        
        # 2. Did the agent output the final Pydantic object?
        elif message.parsed:
            logger.info("Agent successfully converged on a final structured response.")
            return message.parsed
            
        # 3. Failsafe if the model somehow exits without calling a tool or parsing
        else:
            break

    # If the loop exhausts its steps without returning a final decision, degrade gracefully
    logger.warning("Agent exhausted maximum steps without making a final decision. Downgrading to Human Audit.")
    return TriageResponse(
        incident_type="Requires Human Audit",
        disaster_type="Unverified (Timeout)",
        urgency_score=1,
        financial_target_usd=0.0,
        location_mentions=[],
        classification_source="osint_swarm_timeout"
    )
