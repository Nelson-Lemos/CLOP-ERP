import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import SessionLocal
from app.routers import audit, auth, dashboard, departments, notifications, productivity, reports, tasks, users
from app.services.task_service import mark_overdue_tasks

logger = logging.getLogger("clop")

UPLOAD_ROOT = Path(settings.UPLOAD_DIR)
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
(UPLOAD_ROOT / "photos").mkdir(parents=True, exist_ok=True)


async def _overdue_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(_run_overdue_scan)
        except Exception:
            logger.exception("Falha na atualização automática de tarefas atrasadas")
        await asyncio.sleep(settings.OVERDUE_SCAN_INTERVAL_SECONDS)


def _run_overdue_scan() -> None:
    db = SessionLocal()
    try:
        updated = mark_overdue_tasks(db)
        if updated:
            logger.info("Tarefas marcadas como atrasadas: %s", updated)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_overdue_loop())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(departments.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(productivity.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(audit.router, prefix="/api")

app.mount("/api/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")


@app.get("/", tags=["Root"])
def root() -> dict:
    return {
        "name": settings.PROJECT_NAME,
        "description": settings.PROJECT_DESCRIPTION,
        "version": settings.VERSION,
        "docs": "/docs",
    }


@app.get("/api/health", tags=["Health"])
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/jobs/mark-overdue", tags=["Jobs"])
def manual_mark_overdue() -> dict:
    db = SessionLocal()
    try:
        updated = mark_overdue_tasks(db)
        return {"updated": updated}
    finally:
        db.close()