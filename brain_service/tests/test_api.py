from pathlib import Path
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import create_app
from app.triage import TriageService


class MockLLMClient:
    def triage(self, raw_text: str) -> dict:
        return {
            "disaster_type": "Flood",
            "urgency_score": 5,
            "location_mentions": ["Old Bridge", "Mercy Hospital"],
        }


def test_triage_endpoint_returns_structured_json() -> None:
    app = create_app(service=TriageService(llm_client=MockLLMClient()))
    client = TestClient(app)

    response = client.post(
        "/triage",
        json={
            "raw_text": "Flood waters are sweeping people away near Old Bridge and Mercy Hospital."
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["disaster_type"] == "Flood"
    assert body["urgency_score"] == 5
    assert body["location_mentions"] == ["Old Bridge", "Mercy Hospital"]
    assert body["classification_source"] == "llm"
    assert body["incident_type"] == "Natural_Disaster"
    assert "financial_target_usd" in body
