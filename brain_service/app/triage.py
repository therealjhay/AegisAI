import json
import os
import re
from dataclasses import dataclass
from typing import Any, Protocol


class SupportsTriage(Protocol):
    def triage(self, raw_text: str) -> dict[str, Any]:
        ...


def extract_disaster_type(text: str) -> str:
    lowered = text.lower()
    disaster_keywords = {
        "Flood": ["flood", "flash flood", "water level", "overflow", "inundat"],
        "Fire": ["fire", "wildfire", "blaze", "smoke", "burning"],
        "Earthquake": ["earthquake", "tremor", "aftershock", "seismic"],
        "Landslide": ["landslide", "mudslide", "rockfall", "slope collapse"],
        "Storm": ["storm", "cyclone", "hurricane", "typhoon", "tornado"],
        "Heatwave": ["heatwave", "extreme heat", "high temperature"],
        "Drought": ["drought", "water shortage", "dry spell"],
    }
    for disaster_type, keywords in disaster_keywords.items():
        if any(keyword in lowered for keyword in keywords):
            return disaster_type
    return "Unknown"


def score_threat_to_life(text: str) -> int:
    lowered = text.lower()

    critical_signals = [
        "trapped",
        "people missing",
        "people are missing",
        "cannot evacuate",
        "swept away",
        "calling for help",
        "fatal",
        "dead",
        "lifethreatening",
        "life threatening",
        "building collapse",
    ]
    high_signals = [
        "injured",
        "rapidly rising",
        "spreading fast",
        "homes on fire",
        "evacuate now",
        "rescue needed",
        "major damage",
    ]
    moderate_signals = [
        "evacuation advisory",
        "road closed",
        "power outage",
        "localized flooding",
        "small fire",
    ]

    if any(signal in lowered for signal in critical_signals):
        return 5
    if any(signal in lowered for signal in high_signals):
        return 4
    if any(signal in lowered for signal in moderate_signals):
        return 3
    if "contained" in lowered or "under control" in lowered:
        return 2
    return 1


def extract_location_mentions(text: str) -> list[str]:
    landmark_keywords = [
        "hospital",
        "school",
        "bridge",
        "dam",
        "airport",
        "market",
        "station",
        "mosque",
        "church",
    ]
    matches: list[str] = []

    location_pattern = re.compile(
        r"\b(?:in|at|near|around|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)"
    )
    for match in location_pattern.findall(text):
        matches.append(match.strip())

    landmark_pattern = re.compile(
        r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:"
        + "|".join(landmark_keywords)
        + r"))\b",
        flags=re.IGNORECASE,
    )
    for match in landmark_pattern.findall(text):
        normalized = " ".join(word.capitalize() for word in match.split())
        matches.append(normalized.strip())

    deduped: list[str] = []
    seen: set[str] = set()
    for item in matches:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    return deduped


@dataclass
class OpenAILLMClient:
    model: str = "gpt-4o-mini"

    def triage(self, raw_text: str) -> dict[str, Any]:
        from openai import OpenAI

        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        completion = client.chat.completions.create(
            model=self.model,
            response_format={"type": "json_object"},
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an emergency triage assistant. Return strict JSON with keys: "
                        "disaster_type (string), urgency_score (1-5 integer based on threat to life), "
                        "location_mentions (string array)."
                    ),
                },
                {"role": "user", "content": raw_text},
            ],
        )
        content = completion.choices[0].message.content
        if not content:
            raise ValueError("LLM returned empty response content")
        parsed = json.loads(content)
        parsed["urgency_score"] = max(1, min(5, int(parsed["urgency_score"])))
        parsed["location_mentions"] = [
            str(location).strip()
            for location in parsed.get("location_mentions", [])
            if str(location).strip()
        ]
        parsed["disaster_type"] = str(parsed.get("disaster_type", "Unknown")).strip() or "Unknown"
        return parsed


class TriageService:
    def __init__(self, llm_client: SupportsTriage | None = None):
        self.llm_client = llm_client

    def triage(self, raw_text: str) -> dict[str, Any]:
        if self.llm_client is not None:
            result = self.llm_client.triage(raw_text)
            return {
                "disaster_type": result["disaster_type"],
                "urgency_score": max(1, min(5, int(result["urgency_score"]))),
                "location_mentions": list(result.get("location_mentions", [])),
                "classification_source": "llm",
            }

        if os.environ.get("OPENAI_API_KEY"):
            llm_result = OpenAILLMClient().triage(raw_text)
            return {
                "disaster_type": llm_result["disaster_type"],
                "urgency_score": llm_result["urgency_score"],
                "location_mentions": llm_result["location_mentions"],
                "classification_source": "llm",
            }

        return {
            "disaster_type": extract_disaster_type(raw_text),
            "urgency_score": score_threat_to_life(raw_text),
            "location_mentions": extract_location_mentions(raw_text),
            "classification_source": "heuristic",
        }
