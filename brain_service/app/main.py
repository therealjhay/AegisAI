from fastapi import FastAPI
from pydantic import BaseModel, Field

from .triage import TriageService


class TriageRequest(BaseModel):
    raw_text: str = Field(min_length=1, description="Unstructured crisis report text (Telegram, Logs, SMS)")


class TriageResponse(BaseModel):
    incident_type: str = Field(description="Natural_Disaster or Terrorism_Attack")
    disaster_type: str = Field(description="Specific sub-category (e.g. Explosion, Flood)")
    urgency_score: int = Field(ge=1, le=5)
    financial_target_usd: float = Field(ge=0, description="Estimated emergency funding needed")
    location_mentions: list[str]
    classification_source: str


def create_app(service: TriageService | None = None) -> FastAPI:
    app = FastAPI(title="AegisAI Brain Service", version="0.1.0")
    triage_service = service or TriageService()

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/triage", response_model=TriageResponse)
    async def triage(request: TriageRequest) -> TriageResponse:
        result = triage_service.triage(request.raw_text)
        return TriageResponse(**result)

    return app


app = create_app()
