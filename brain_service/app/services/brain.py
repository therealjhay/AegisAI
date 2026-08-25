import json
import logging
import os
from typing import Any, Dict, List

import openai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .swarm_agents import run_quorum

# Setup basic logging
logger = logging.getLogger("aegis.swarm")
logging.basicConfig(level=logging.INFO)

# -----------------------------------------------------------------------------
# 1. Models and Schemas
# -----------------------------------------------------------------------------

class TriageRequest(BaseModel):
    raw_text: str = Field(min_length=1, description="Unstructured crisis report text (Telegram, Logs, SMS)")
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    report_count: int | None = Field(default=None, ge=1)
    sources: List[str] | None = None

class TriageResponse(BaseModel):
    incident_type: str = Field(description="Natural_Disaster, Terrorism_Attack, or 'Requires Human Audit'")
    disaster_type: str = Field(description="Specific sub-category (e.g., Explosion, Flood, Unverified)")
    urgency_score: int = Field(ge=1, le=5, description="1-5 scale based on immediate threat to life")
    financial_target_usd: float = Field(ge=0, description="Estimated emergency funding needed")
    location_mentions: list[str] = Field(description="List of detected locations")
    classification_source: str = Field(default="osint_swarm")
    # Swarm extension fields (optional for backward compat)
    quorum: Dict[str, Any] | None = None
    votes: List[Dict[str, Any]] | None = None

class QuorumRequest(BaseModel):
    clusterId: str
    lat: float
    lon: float
    reportCount: int = 1
    radiusM: float = 100
    sources: List[str] = Field(default_factory=lambda: ["unknown"])
    rawTexts: List[str]
    urgencyScores: List[int]
    totalFinancialTarget: float = 0

# -----------------------------------------------------------------------------
# 2. Tool (Function) Definitions — kept for LLM supervisor fallback
# -----------------------------------------------------------------------------

def search_local_news(query: str, location: str) -> str:
    logger.info(f"Executing search_local_news(query={query!r}, location={location!r})")
    query_lower = query.lower()
    if "bomb" in query_lower or "explosion" in query_lower or "attack" in query_lower:
        return f"Recent news in {location}: Verified reports of an explosion in the city center within the last hour. Emergency services are on scene."
    if "flood" in query_lower or "water" in query_lower:
        return f"Recent news in {location}: Local news reports heavy flooding and road closures."
    return f"No corroborating recent news found for '{query}' in {location} over the last 3 hours."

def check_weather_anomaly(latitude: float, longitude: float) -> str:
    logger.info(f"Executing check_weather_anomaly(lat={latitude}, lon={longitude})")
    if latitude > 0 and longitude > 0:
        return f"Weather Station Data at {latitude}, {longitude}: Extreme rainfall and severe thunderstorm warnings active."
    return f"Normal weather conditions reported at {latitude}, {longitude}."

AVAILABLE_TOOLS = {
    "search_local_news": search_local_news,
    "check_weather_anomaly": check_weather_anomaly
}

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_local_news",
            "description": "Searches for recent local news regarding an event to corroborate a crisis report.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "location": {"type": "string"}
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
                    "latitude": {"type": "number"},
                    "longitude": {"type": "number"}
                },
                "required": ["latitude", "longitude"]
            }
        }
    }
]

SYSTEM_PROMPT = """You are the Aegis Supervisor Agent. You receive raw crisis reports. 
Before assigning an Urgency Score or routing funds, you MUST use the provided search or weather tools to look for corroborating evidence from the last 3 hours. 
If you cannot verify the event via tools, you must downgrade the status to 'Requires Human Audit' with Urgency Score 1 and 0 funds.
Output your final response using the required structured output schema."""

router = APIRouter()

# -----------------------------------------------------------------------------
# 3. Helpers — deterministic swarm from raw_text (no LLM needed)
# -----------------------------------------------------------------------------

def _infer_urgency(text: str) -> int:
    low = text.lower()
    critical = ["trapped","people missing","cannot evacuate","swept away","calling for help","fatal","dead","building collapse"]
    high = ["injured","rapidly rising","spreading fast","homes on fire","evacuate now","rescue needed","major damage"]
    mod = ["evacuation advisory","road closed","power outage","localized flooding","small fire"]
    if any(s in low for s in critical): return 5
    if any(s in low for s in high): return 4
    if any(s in low for s in mod): return 3
    if "contained" in low or "under control" in low: return 2
    return 2

def _infer_disaster(text: str) -> str:
    low = text.lower()
    if any(k in low for k in ["flood","flash flood","water level","overflow","inundat"]): return "Flood"
    if any(k in low for k in ["fire","wildfire","blaze","smoke","burning"]): return "Fire"
    if any(k in low for k in ["earthquake","tremor","aftershock","seismic"]): return "Earthquake"
    if any(k in low for k in ["bomb","explosion","attack","gunfire","terror"]): return "Explosion"
    return "Unknown"

def _infer_locations(text: str) -> list[str]:
    import re
    pattern = re.compile(r"\b(?:in|at|near|around|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)")
    return pattern.findall(text)[:3]

# -----------------------------------------------------------------------------
# 4. Endpoints
# -----------------------------------------------------------------------------

@router.post("/verify", response_model=TriageResponse)
def swarm_verify_endpoint(request: TriageRequest) -> TriageResponse:
    """
    Pillar 2: Deterministic 4-agent quorum (triangulator, fact_checker, triage, governor).
    If OPENAI_API_KEY is present and USE_LLM_SWARM=1, tries LLM supervisor first, else deterministic swarm.
    """
    # Try LLM swarm if explicitly enabled and key present
    if os.environ.get("OPENAI_API_KEY") and os.environ.get("USE_LLM_SWARM") == "1":
        try:
            return _llm_supervisor_verify(request)
        except Exception as e:
            logger.warning(f"LLM swarm failed, falling back to deterministic: {e}")

    # Deterministic quorum path (works offline)
    text = request.raw_text
    urgency = _infer_urgency(text)
    disaster = _infer_disaster(text)
    locations = _infer_locations(text) or ["Maiduguri Market"]
    lat = request.lat if request.lat is not None else 11.84
    lon = request.lon if request.lon is not None else 13.15
    rc = request.report_count or 1
    sources = request.sources or (["social_media"] if "social" in text.lower() else ["ngo_partner"])

    cluster = {
        "clusterId": f"swarm-{abs(hash(text)) % 1000000}",
        "lat": lat,
        "lon": lon,
        "reportCount": rc,
        "radiusM": 120 if rc==1 else 380,
        "sources": sources,
        "rawTexts": [text],
        "urgencyScores": [urgency],
        "totalFinancialTarget": urgency * 5000,
    }
    quorum = run_quorum(cluster)

    # Map quorum to TriageResponse
    if quorum["status"] == "verified":
        incident_type = "Terrorism_Attack" if disaster == "Explosion" else "Natural_Disaster"
        # cappedAmount is governor effective
        amt = float(quorum["cappedAmountUSD"])
    elif quorum["status"] == "quarantined":
        return TriageResponse(
            incident_type="Requires Human Audit",
            disaster_type="Quarantined (Multi-agent NO)",
            urgency_score=1,
            financial_target_usd=0.0,
            location_mentions=locations,
            classification_source="swarm_quorum_quarantined",
            quorum=quorum,
            votes=quorum["votes"],
        )
    else:
        return TriageResponse(
            incident_type="Requires Human Audit",
            disaster_type="Unverified (Quorum not reached)",
            urgency_score=1,
            financial_target_usd=0.0,
            location_mentions=locations,
            classification_source="swarm_quorum_audit",
            quorum=quorum,
            votes=quorum["votes"],
        )

    return TriageResponse(
        incident_type=incident_type,
        disaster_type=disaster,
        urgency_score=urgency,
        financial_target_usd=amt,
        location_mentions=locations,
        classification_source="swarm_quorum",
        quorum=quorum,
        votes=quorum["votes"],
    )

@router.post("/quorum")
def quorum_endpoint(req: QuorumRequest) -> Dict[str, Any]:
    """Direct quorum computation from cluster payload (used by Next.js orchestrator)."""
    cluster = {
        "clusterId": req.clusterId,
        "lat": req.lat,
        "lon": req.lon,
        "reportCount": req.reportCount,
        "radiusM": req.radiusM,
        "sources": req.sources,
        "rawTexts": req.rawTexts,
        "urgencyScores": req.urgencyScores,
        "totalFinancialTarget": req.totalFinancialTarget,
    }
    return run_quorum(cluster)

def _llm_supervisor_verify(request: TriageRequest) -> TriageResponse:
    client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
    messages: List[Dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Please verify and triage the following raw report:\n\n{request.raw_text}"}
    ]
    for step in range(5):
        response = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=messages,  # type: ignore
            tools=TOOLS_SCHEMA,  # type: ignore
            response_format=TriageResponse,  # type: ignore
        )
        message = response.choices[0].message
        if message.tool_calls:
            messages.append(message)  # type: ignore
            for tool_call in message.tool_calls:
                func_name = tool_call.function.name
                func_args = json.loads(tool_call.function.arguments)
                if func_name in AVAILABLE_TOOLS:
                    tool_result = AVAILABLE_TOOLS[func_name](**func_args)  # type: ignore
                else:
                    tool_result = f"Error: Tool '{func_name}' is not recognized."
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": str(tool_result)
                })
        elif message.parsed:
            return message.parsed  # type: ignore
        else:
            break
    return TriageResponse(
        incident_type="Requires Human Audit",
        disaster_type="Unverified (Timeout)",
        urgency_score=1,
        financial_target_usd=0.0,
        location_mentions=[],
        classification_source="osint_swarm_timeout"
    )
