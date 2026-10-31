from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from database import get_db
from models import Officer
from schemas.auth import OfficerResponse, TokenResponse
from services.auth_service import (
    authenticate_officer,
    create_access_token,
    get_current_officer,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Login to obtain JWT access token",
)
async def login_for_access_token(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Authenticate municipal officer or administrator:
    Supports both JSON request body (for frontend) and URL-encoded form data (for Swagger UI Authorize).
    Returns a signed JWT bearer token.
    """
    content_type = request.headers.get("content-type", "")
    email = None
    password = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            email = body.get("email") or body.get("username")
            password = body.get("password")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid JSON payload.",
            )
    else:
        form = await request.form()
        email = form.get("username") or form.get("email")
        password = form.get("password")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required.",
        )

    officer = authenticate_officer(db=db, email=email, password=password)
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_data = {
        "sub": officer.email,
        "officer_id": officer.id,
        "role": officer.role,
        "department": officer.department,
        "name": officer.name,
    }
    access_token = create_access_token(data=token_data)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=officer.role,
        department=officer.department,
        name=officer.name,
    )


@router.get(
    "/me",
    response_model=OfficerResponse,
    summary="Get current authenticated officer profile",
)
def read_current_officer(
    current_officer: Officer = Depends(get_current_officer),
):
    """
    Returns the public profile of the currently logged-in officer or admin.
    Requires Bearer JWT token in Authorization header.
    """
    return current_officer

