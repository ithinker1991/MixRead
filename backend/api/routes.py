"""
API Routes - FastAPI endpoints

Presentation layer that exposes the application services via HTTP
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from infrastructure.database import get_db
from infrastructure.repositories import UserRepository
from application.services import UserApplicationService, HighlightApplicationService

router = APIRouter(prefix="/users", tags=["users"])


class MarkWordRequest(BaseModel):
    """Request model for marking words"""
    word: str


class HighlightWordsRequest(BaseModel):
    """Request model for getting highlighted words"""
    user_id: str
    words: list[str]
    difficulty_level: str = "B1"


# Dependency injection helpers
def get_user_service(db: Session = Depends(get_db)):
    """Get user application service"""
    repo = UserRepository(db)
    return UserApplicationService(repo)


# User Management Routes

@router.get("/{user_id}")
async def get_user(user_id: str, db: Session = Depends(get_db)):
    """Get user's complete data"""
    service = UserApplicationService(UserRepository(db))
    result = service.get_user_data(user_id)
    return result


@router.get("/{user_id}/known-words")
async def get_known_words(user_id: str, db: Session = Depends(get_db)):
    """Get user's known words list"""
    service = UserApplicationService(UserRepository(db))
    result = service.get_known_words(user_id)
    return result


@router.post("/{user_id}/known-words")
async def mark_word_as_known(
    user_id: str,
    request: MarkWordRequest,
    service: UserApplicationService = Depends(get_user_service)
):
    """Mark a word as known"""
    result = service.mark_word_as_known(user_id, request.word)
    return result


@router.delete("/{user_id}/known-words/{word}")
async def unmark_word_as_known(
    user_id: str,
    word: str,
    service: UserApplicationService = Depends(get_user_service)
):
    """Remove a word from known words"""
    result = service.unmark_word_as_known(user_id, word)
    return result


@router.get("/{user_id}/unknown-words")
async def get_unknown_words(user_id: str, db: Session = Depends(get_db)):
    """Get user's unknown words list"""
    service = UserApplicationService(UserRepository(db))
    result = service.get_unknown_words(user_id)
    return result


@router.post("/{user_id}/unknown-words")
async def mark_word_as_unknown(
    user_id: str,
    request: MarkWordRequest,
    service: UserApplicationService = Depends(get_user_service)
):
    """Mark a word as unknown/not knowing"""
    result = service.mark_word_as_unknown(user_id, request.word)
    return result


@router.delete("/{user_id}/unknown-words/{word}")
async def unmark_word_as_unknown(
    user_id: str,
    word: str,
    service: UserApplicationService = Depends(get_user_service)
):
    """Remove a word from unknown words"""
    result = service.unmark_word_as_unknown(user_id, word)
    return result


@router.get("/{user_id}/vocabulary")
async def get_vocabulary(user_id: str, db: Session = Depends(get_db)):
    """Get user's vocabulary list"""
    service = UserApplicationService(UserRepository(db))
    user_data = service.get_user_data(user_id)
    return {
        "success": True,
        "vocabulary": user_data["vocabulary"]
    }


@router.post("/{user_id}/vocabulary")
async def add_to_vocabulary(
    user_id: str,
    request: MarkWordRequest,
    service: UserApplicationService = Depends(get_user_service)
):
    """Add a word to vocabulary"""
    result = service.add_to_vocabulary(user_id, request.word)
    return result


@router.delete("/{user_id}/vocabulary/{word}")
async def remove_from_vocabulary(
    user_id: str,
    word: str,
    service: UserApplicationService = Depends(get_user_service)
):
    """Remove a word from vocabulary"""
    result = service.remove_from_vocabulary(user_id, word)
    return result
