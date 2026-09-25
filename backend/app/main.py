"""MediTrack FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine
from app.routers import (
    analytics,
    appointments,
    audit,
    auth,
    diagnoses,
    insights,
    lab,
    patients,
    prescriptions,
    professionals,
    records,
    simulator as simulator_router,
)
from app.services.simulator import simulator


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Dev convenience: create tables if they don't exist.
    # Production uses Alembic migrations instead.
    Base.metadata.create_all(bind=engine)

    # Apply the raw-SQL database layer: functions, triggers (audit + updated_at
    # + conflict), analytical views and tuned indexes. Idempotent.
    from app.db.bootstrap import apply_database_layer

    apply_database_layer()

    # Ensure baseline reference data / staff / starter patients exist, then
    # optionally boot the live hospital simulation engine.
    simulator.ensure_baseline()
    if settings.simulator_autostart:
        simulator.start(interval=settings.simulator_interval_seconds)

    yield

    simulator.stop()


app = FastAPI(
    title=settings.project_name,
    version="1.0.0",
    description="Smart Patient & Clinical Record Management System — SESAP ZC337",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

prefix = settings.api_v1_prefix
for r in (auth, patients, professionals, appointments, diagnoses, prescriptions, lab, analytics, audit, records, insights, simulator_router):
    app.include_router(r.router, prefix=prefix)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "service": settings.project_name}
