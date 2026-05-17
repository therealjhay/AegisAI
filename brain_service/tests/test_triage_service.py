from pathlib import Path
import sys

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.triage import TriageService, score_threat_to_life


class MockLLMClient:
    def triage(self, raw_text: str) -> dict:
        if "wildfire" in raw_text.lower():
            return {
                "disaster_type": "Fire",
                "urgency_score": 5,
                "location_mentions": ["Hilltop Village", "Central School"],
            }
        return {
            "disaster_type": "Flood",
            "urgency_score": 4,
            "location_mentions": ["Old Bridge"],
        }


@pytest.mark.parametrize(
    ("raw_text", "expected_score"),
    [
        (
            "Flash flood waters are rapidly rising and families are trapped in homes near Old Bridge.",
            5,
        ),
        (
            "Wildfire is spreading fast toward residential blocks and evacuation is underway.",
            4,
        ),
        (
            "Localized flooding caused a road closed near River Market, no injuries reported.",
            3,
        ),
        (
            "Small brush fire is contained near the station with no immediate danger.",
            2,
        ),
    ],
)
def test_score_threat_to_life_consistency(raw_text: str, expected_score: int) -> None:
    assert score_threat_to_life(raw_text) == expected_score


def test_triage_service_uses_mock_llm() -> None:
    service = TriageService(llm_client=MockLLMClient())
    result = service.triage(
        "Wildfire threatens Hilltop Village and smoke is moving toward Central School."
    )

    assert result["disaster_type"] == "Fire"
    assert result["urgency_score"] == 5
    assert result["location_mentions"] == ["Hilltop Village", "Central School"]
    assert result["classification_source"] == "llm"
