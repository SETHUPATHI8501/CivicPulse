import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import engine, get_db, run_migrations
import models  # Ensures models are imported and registered with Base.metadata
from api.auth import router as auth_router
from api.complaints import router as complaints_router
from api.officer import router as officer_router
from api.analytics import router as analytics_router
from api.advanced import router as advanced_router

# Resolve upload directories relative to backend root
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
COMPLAINTS_DIR = UPLOADS_DIR / "complaints"
RESOLUTIONS_DIR = UPLOADS_DIR / "resolutions"
SOS_DIR = UPLOADS_DIR / "sos"
WORKERS_DIR = UPLOADS_DIR / "workers"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan manager:
    - Creates upload directories at application startup.
    - Runs safe, repeatable migrations (schema & columns).
    """
    COMPLAINTS_DIR.mkdir(parents=True, exist_ok=True)
    RESOLUTIONS_DIR.mkdir(parents=True, exist_ok=True)
    SOS_DIR.mkdir(parents=True, exist_ok=True)
    WORKERS_DIR.mkdir(parents=True, exist_ok=True)
    run_migrations(engine)
    yield


# Initialize FastAPI application with lifespan
app = FastAPI(
    title="CivicPulse AI",
    version="2.0.0",
    lifespan=lifespan,
)

# Configure CORS for Web (Vite) and Mobile (Expo React Native & LAN testing)
APP_ENV = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower().strip()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
    "http://localhost:19000",
    "http://localhost:19006",
]

env_origins = os.getenv("CORS_ORIGINS")
if env_origins:
    origins.extend([o.strip() for o in env_origins.split(",") if o.strip()])

# In development mode, allow local LAN IPs so physical Android devices and emulators connect
allow_origin_regex = (
    r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$"
    if APP_ENV != "production"
    else None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static directory for uploads with check_dir=False
app.mount(
    "/uploads",
    StaticFiles(directory=str(UPLOADS_DIR), check_dir=False),
    name="uploads",
)

# Include API routers under /api/v1
app.include_router(auth_router, prefix="/api/v1")
app.include_router(complaints_router, prefix="/api/v1")
app.include_router(officer_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(advanced_router, prefix="/api/v1")


@app.get("/", tags=["Root"])
def read_root():
    """
    Root endpoint returning project name and running status.
    """
    return {
        "project": "CivicPulse AI",
        "status": "running",
    }


@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint verifying application and database connectivity status.
    Executes an actual 'SELECT 1' test query against the database.
    Returns HTTP 200 when healthy, or HTTP 503 if database check fails.
    """
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "database": f"disconnected: {str(exc)}",
            },
        )
