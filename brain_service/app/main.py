from fastapi import FastAPI
from pydantic import BaseModel, Field

from .services.brain import router as swarm_router
from .triage import TriageService


class TriageRequest(BaseModel):
    raw_text: str = Field(min_length=1, description="Unstructured crisis report text (Telegram, Logs, SMS)")


class TriageResponse(BaseModel):
    incident_type: str = Field(description="Natural_Disaster, Terrorism_Attack, or Requires Human Audit")
    disaster_type: str = Field(description="Specific sub-category (e.g. Explosion, Flood)")
    urgency_score: int = Field(ge=1, le=5)
    financial_target_usd: float = Field(ge=0, description="Estimated emergency funding needed")
    location_mentions: list[str]
    classification_source: str


def create_app(service: TriageService | None = None) -> FastAPI:
    app = FastAPI(title="AegisAI Brain Service (Swarm)", version="0.2.0")
    triage_service = service or TriageService()

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/triage", response_model=TriageResponse)
    async def triage(request: TriageRequest) -> TriageResponse:
        result = triage_service.triage(request.raw_text)
        return TriageResponse(**result)

    # Swarm OSINT verification quorum (Idea 3 Pillar 2)
    app.include_router(swarm_router, prefix="/swarm")

    return app


app = create_app()
