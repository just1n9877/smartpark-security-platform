from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import app.models  # noqa: F401 — register ORM tables on Base.metadata
from app.config import settings
from app.database import Base, SessionLocal, engine, ensure_sqlite_migrations
from app.routers import alerts_routes, auth_routes, cameras_routes, dashboard_routes, jobs_routes
from app.seed import seed_users_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_migrations()
    db = SessionLocal()
    try:
        seed_users_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="智慧园区安防 AI 管理与仿真平台 API",
    description="认证、轨迹流水线、告警与任务",
    version="0.2.0",
    lifespan=lifespan,
)

app.include_router(auth_routes.router, prefix="/auth", tags=["auth"])
app.include_router(alerts_routes.router, prefix="/alerts", tags=["alerts"])
app.include_router(cameras_routes.router, prefix="/cameras", tags=["cameras"])
app.include_router(jobs_routes.router, prefix="/jobs", tags=["jobs"])
app.include_router(dashboard_routes.router, prefix="/dashboard", tags=["dashboard"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_storage = settings.project_root / "storage"
_storage.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=str(_storage)), name="media")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
