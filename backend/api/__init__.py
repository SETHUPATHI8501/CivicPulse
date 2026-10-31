from api.auth import router as auth_router
from api.complaints import router as complaints_router
from api.officer import router as officer_router

__all__ = [
    "auth_router",
    "complaints_router",
    "officer_router",
]
