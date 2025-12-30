from application.auth_service import AuthService
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
    """
    try:
        user_repo = UserRepository(db)
        auth_service = AuthService(user_repo)
        
        result = auth_service.login_with_google(auth_request.token)
        return result
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
