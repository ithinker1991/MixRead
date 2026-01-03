from application.auth_service import (
    AuthConfigurationError,
    AuthService,
    InvalidTokenError,
    TokenExpiredError,
)
from fastapi import APIRouter, Body, Depends, HTTPException
from infrastructure.database import get_db
from infrastructure.repositories import UserRepository
from pydantic import BaseModel
from sqlalchemy.orm import Session

router = APIRouter()

class GoogleAuthRequest(BaseModel):
    token: str

from typing import Optional


class AuthResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    avatar: Optional[str] = None

@router.post("/auth/google", response_model=AuthResponse)
async def google_login(
    auth_request: GoogleAuthRequest = Body(...),
    db: Session = Depends(get_db)
):
    """
    Authenticate with Google ID Token
    
    Returns:
        AuthResponse with access_token and user info
        
    Raises:
        HTTPException 401: When token is invalid, expired, or verification fails
        HTTPException 500: When server configuration is invalid
    
    (Requirements 4.2, 4.4)
    """
    try:
        user_repo = UserRepository(db)
        auth_service = AuthService(user_repo)
        
        result = auth_service.login_with_google(auth_request.token)
        return result
    except AuthConfigurationError as e:
        # Server configuration error - return 500
        raise HTTPException(
            status_code=500, 
            detail="Server configuration error: Authentication service is not properly configured"
        )
    except TokenExpiredError as e:
        # Token expired - return 401 with descriptive message (Requirement 4.4)
        raise HTTPException(
            status_code=401, 
            detail=f"Token expired: {e.message}"
        )
    except InvalidTokenError as e:
        # Invalid token - return 401 with descriptive message (Requirement 4.2)
        raise HTTPException(
            status_code=401, 
            detail=f"Invalid token: {e.message}"
        )
    except Exception as e:
        # Catch-all for unexpected errors - still return 401 for auth failures
        raise HTTPException(
            status_code=401, 
            detail=f"Authentication failed: {str(e)}"
        )
