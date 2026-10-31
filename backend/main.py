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

# Resolve upload directories relative to backend root
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
COMPLAINTS_DIR = UPLOADS_DIR / "complaints"
RESOLUTIONS_DIR = UPLOADS_DIR / "resolutions"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan manager:
    - Creates upload directories at application startup.
    - Runs safe, repeatable migrations (schema & columns).
    """
    # Startup actions
    COMPLAINTS_DIR.mkdir(parents=True, exist_ok=True)
    RESOLUTIONS_DIR.mkdir(parents=True, exist_ok=True)
    run_migrations(engine)
    yield
    # Shutdown actions (if any)


# Initialize FastAPI application with lifespan
app = FastAPI(
    title="CivicPulse AI",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure development CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
