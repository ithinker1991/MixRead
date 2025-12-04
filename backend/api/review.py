"""
Review API endpoints for the vocabulary review system

Handles review sessions, submissions, and statistics.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from uuid import uuid4

from infrastructure.database import get_db
from infrastructure.repositories import VocabularyRepository
from application.srs_adapter import VocabularyReviewProvider
from srs_core.scheduler import SpacedRepetitionEngine
from srs_core.models import ReviewSession, LearningStatus

# In-memory store for active sessions (use Redis in production)
active_sessions = {}

router = APIRouter(
    prefix="/users/{user_id}/review",
    tags=["review"],
    responses={404: {"description": "Not found"}},
)


@router.post("/session")
async def start_review_session(
    user_id: str,
    session_type: str = "mixed",
    db: Session = Depends(get_db),
):
    """
    Start a new review session

    Args:
        user_id: User ID
        session_type: "new" (only new words), "review" (only due), "mixed" (both)

    Returns:
        session_id and first card
    """
    try:
        # Create provider and session
        vocab_repo = VocabularyRepository(db)
        provider = VocabularyReviewProvider(vocab_repo)

        session = ReviewSession(provider)

        # Build session based on type
        if session_type == "new":
            status_list = [LearningStatus.NEW]
            limits = {LearningStatus.NEW: 5}
        elif session_type == "review":
            status_list = [LearningStatus.DUE]
            limits = {LearningStatus.DUE: 20}
        else:  # "mixed"
            status_list = [LearningStatus.DUE, LearningStatus.NEW]
            limits = {LearningStatus.DUE: 20, LearningStatus.NEW: 5}

        # Build the session
        if not session.build_session(status_list, limits):
            return {
                "success": False,
                "error": "No cards available for review",
            }

        # Save session
        session_id = str(uuid4())
        active_sessions[session_id] = session

        # Return first card
        first_card = session.get_current_card()

        return {
            "success": True,
            "session_id": session_id,
            "total_cards": len(session.cards),
            "first_card": first_card.to_dict() if first_card else None,
            "progress": session.get_progress(),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/answer")
async def submit_review_answer(
    user_id: str,
    session_id: str,
    quality: int,
    db: Session = Depends(get_db),
):
    """
    Submit an answer and get the next card

    Args:
        user_id: User ID
        session_id: Session ID
        quality: Quality score (0-5)

    Returns:
        Review result and next card
    """
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    if not (0 <= quality <= 5):
        raise HTTPException(status_code=400, detail="Quality must be 0-5")

    try:
        session = active_sessions[session_id]
        scheduler = SpacedRepetitionEngine()

        # Submit answer
        result = session.submit_answer(quality, scheduler)

        if not result:
            raise HTTPException(status_code=400, detail="Invalid card")

        # Check if session is complete
        if session.is_complete():
            summary = session.end_session()
            del active_sessions[session_id]

            return {
                "success": True,
                "result": result.to_dict(),
                "session_complete": True,
                "session_summary": summary,
            }

        # Get next card
        next_card = session.next_card()

        return {
            "success": True,
            "result": result.to_dict(),
            "next_card": next_card.to_dict() if next_card else None,
            "progress": session.get_progress(),
            "session_complete": False,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_review_stats(
    user_id: str,
    period: str = "week",
    db: Session = Depends(get_db),
):
    """
    Get review statistics for a period

    Args:
        user_id: User ID
        period: "day", "week", "month"

    Returns:
        Review statistics
    """
    try:
        # TODO: Implement review statistics
        # This would query the review history and calculate metrics
        return {
            "success": True,
            "data": {
                "period": period,
                "total_reviews": 0,
                "accuracy_rate": 0,
                "words_mastered": 0,
                "streak_count": 0,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/schedule")
async def get_review_schedule(
    user_id: str,
    days: int = 7,
    db: Session = Depends(get_db),
):
    """
    Get upcoming review schedule

    Args:
        user_id: User ID
        days: Number of days to forecast

    Returns:
        Review schedule for next N days
    """
    try:
        vocab_repo = VocabularyRepository(db)

        # TODO: Implement schedule calculation
        # This would return how many words are due each day

        return {
            "success": True,
            "data": {
                "schedule": [],
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
