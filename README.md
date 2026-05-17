# AegisAI

AegisAI is a defensive, event-driven geospatial platform for NGO disaster triage.

## Implemented phases

- **Phase 1**: Dockerized PostgreSQL 16 + PostGIS 3, Prisma geospatial schema bootstrap.
- **Phase 2**: TypeScript ingestion service with strict JSON validation, duplicate suppression, source credibility scoring, and quarantine routing.
- **Phase 3**: Python FastAPI AI triage microservice for disaster type extraction, urgency scoring, and location mention extraction.

See:
- `SETUP.md` for environment and database setup.
- `src/ingestion/README.md` for ingestion verification workflow.
- `brain_service/` for the AI triage microservice and pytest scenario tests.
