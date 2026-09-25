"""Simulator control routes — start/stop/tune the live hospital data engine."""
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user, require_role
from app.services.simulator import simulator

router = APIRouter(prefix="/simulator", tags=["simulator"])


class IntervalConfig(BaseModel):
    interval: float = Field(gt=0.2, le=60, description="Seconds between simulation ticks")


@router.get("/status")
def sim_status(_=Depends(get_current_user)):
    """Current engine state: running flag, tick interval, totals, uptime."""
    return simulator.status()


@router.get("/events")
def sim_events(limit: int = Query(20, le=100), _=Depends(get_current_user)):
    """Most-recent-first live activity feed."""
    return simulator.recent_events(limit)


@router.post("/start")
def sim_start(cfg: IntervalConfig | None = None, _=Depends(require_role("ADMIN"))):
    simulator.start(interval=cfg.interval if cfg else None)
    return simulator.status()


@router.post("/stop")
def sim_stop(_=Depends(require_role("ADMIN"))):
    simulator.stop()
    return simulator.status()


@router.post("/config")
def sim_config(cfg: IntervalConfig, _=Depends(require_role("ADMIN"))):
    simulator.set_interval(cfg.interval)
    return simulator.status()
