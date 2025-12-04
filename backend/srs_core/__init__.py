"""
SRS Core Library - Reusable spaced repetition system

This library is independent of any application. It provides:
- Pure SRS algorithm (no side effects)
- Session management
- Interface definitions for data providers
"""

from .models import (
    LearningStatus,
    LearningItem,
    ReviewProvider,
    ReviewResult,
    ReviewCard,
    ReviewSession,
)
from .scheduler import SpacedRepetitionEngine

__all__ = [
    "LearningStatus",
    "LearningItem",
    "ReviewProvider",
    "ReviewResult",
    "ReviewCard",
    "ReviewSession",
    "SpacedRepetitionEngine",
]

__version__ = "1.0.0"
