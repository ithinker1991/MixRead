"""
Data models and interfaces for SRS system

All types are application-agnostic. Applications implement ReviewProvider
to provide data to the core library.
"""

from abc import ABC, abstractmethod
from enum import Enum
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, List, Optional


class LearningStatus(Enum):
    """Status of a learning item in the review cycle"""
    NEW = "new"              # Never reviewed
    LEARNING = "learning"    # Being learned
    REVIEWING = "reviewing"  # Under active review
    DUE = "due"             # Due for review
    MASTERED = "mastered"   # Mastered


class LearningItem(ABC):
    """
    Abstract base class for any learnable item

    Applications must extend this to adapt their domain models
    """

    item_id: str
    content: Dict[str, Any]
    status: LearningStatus
    review_interval: int  # hours
    ease_factor: float    # SM-2 difficulty multiplier
    created_at: datetime

    @abstractmethod
    def to_dict(self) -> Dict:
        """Convert to dictionary representation"""
        pass


@dataclass
class ReviewResult:
    """
    Result of a single review action

    Returned by ReviewSession, applied by the application
    """

    item_id: str
    quality: int  # 0-5 (difficulty feedback)
    new_interval: int  # hours
    new_ease: float  # new difficulty factor
    next_review_time: datetime

    def to_dict(self) -> Dict:
        return {
            "item_id": self.item_id,
            "quality": self.quality,
            "new_interval": self.new_interval,
            "new_ease": self.new_ease,
            "next_review_time": self.next_review_time.isoformat(),
        }


class ReviewCard:
    """
    View of a LearningItem for review

    Wraps a LearningItem to present it in a review context
    """

    def __init__(self, item: LearningItem):
        self.item = item

    def to_dict(self) -> Dict:
        """Convert card to dictionary"""
        return {
            "id": self.item.item_id,
            "content": self.item.content,
            "status": self.item.status.value,
            "review_interval": self.item.review_interval,
        }


class ReviewProvider(ABC):
    """
    Abstract interface for providing data to the SRS core library

    Applications must implement this to bridge between their domain
    models and the SRS system.

    This is the key to making the core library reusable:
    - MixRead implements VocabularyReviewProvider(ReviewProvider)
    - HistoryApp implements HistoryEventReviewProvider(ReviewProvider)
    - Both use the exact same SRS core code
    """

    @abstractmethod
    def get_item_by_id(self, item_id: str) -> Optional[LearningItem]:
        """
        Retrieve a single learning item by ID

        Args:
            item_id: The item identifier

        Returns:
            LearningItem or None if not found
        """
        pass

    @abstractmethod
    def get_items_by_status(
        self, status: LearningStatus, limit: int = 20
    ) -> List[LearningItem]:
        """
        Retrieve items by learning status

        Args:
            status: The learning status to filter by
            limit: Maximum number of items to return

        Returns:
            List of LearningItem objects
        """
        pass

    @abstractmethod
    def save_review_result(self, result: ReviewResult) -> None:
        """
        Save the result of a review to persistent storage

        Called after each review to update the item with new SRS values.

        Args:
            result: ReviewResult from the scheduler
        """
        pass


class SessionStats:
    """Statistics tracked during a review session"""

    def __init__(self):
        self.start_time = datetime.now()
        self.cards_reviewed = 0
        self.correct_count = 0
        self.streak = 0
        self.quality_distribution = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0}

    def record_answer(self, quality: int) -> None:
        """Record an answer"""
        self.cards_reviewed += 1
        self.quality_distribution[quality] += 1

        if quality >= 3:
            self.correct_count += 1
            self.streak += 1
        else:
            self.streak = 0

    def get_accuracy(self) -> float:
        """Get accuracy as decimal (0-1)"""
        if self.cards_reviewed == 0:
            return 0
        return self.correct_count / self.cards_reviewed

    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            "cards_reviewed": self.cards_reviewed,
            "correct_count": self.correct_count,
            "accuracy": self.get_accuracy(),
            "streak": self.streak,
            "quality_distribution": self.quality_distribution,
            "duration_seconds": (datetime.now() - self.start_time).total_seconds(),
        }


class ReviewSession:
    """
    Manages a single review session

    Orchestrates interaction between ReviewProvider and SpacedRepetitionEngine.
    Does NOT modify data directly; delegates to ReviewProvider via save_review_result.
    """

    def __init__(self, provider: ReviewProvider):
        self.provider = provider
        self.cards: List[ReviewCard] = []
        self.current_index = 0
        self.stats = SessionStats()
        self.session_id: Optional[str] = None

    def build_session(
        self, status_list: List[LearningStatus], limits: Dict[LearningStatus, int]
    ) -> bool:
        """
        Build a review session from specified statuses

        Args:
            status_list: List of LearningStatus to include (order matters)
            limits: Dict mapping status to max items for that status

        Returns:
            True if session has cards, False otherwise

        Example:
            session.build_session(
                [LearningStatus.DUE, LearningStatus.NEW],
                {LearningStatus.DUE: 20, LearningStatus.NEW: 5}
            )
        """
        items = []

        for status in status_list:
            limit = limits.get(status, 20)
            status_items = self.provider.get_items_by_status(status, limit)
            items.extend(status_items)

        if not items:
            return False

        self.cards = [ReviewCard(item) for item in items]
        return True

    def get_current_card(self) -> Optional[ReviewCard]:
        """Get the current card being reviewed"""
        if 0 <= self.current_index < len(self.cards):
            return self.cards[self.current_index]
        return None

    def submit_answer(
        self, quality: int, scheduler: "SpacedRepetitionEngine"
    ) -> Optional[ReviewResult]:
        """
        Submit an answer and get the review result

        Args:
            quality: Quality feedback (0-5)
            scheduler: SpacedRepetitionEngine to calculate new values

        Returns:
            ReviewResult or None if no current card

        Side effects:
            - Calls provider.save_review_result() to persist changes
            - Updates session statistics
        """
        if not (0 <= quality <= 5):
            raise ValueError("Quality must be 0-5")

        current_card = self.get_current_card()
        if not current_card:
            return None

        item = current_card.item

        # Calculate new SRS values using pure scheduler
        next_interval, new_ease = scheduler.calculate_interval(
            current_interval=item.review_interval,
            quality=quality,
            ease_factor=item.ease_factor,
        )

        # Create result object (no persistence yet)
        result = ReviewResult(
            item_id=item.item_id,
            quality=quality,
            new_interval=next_interval,
            new_ease=new_ease,
            next_review_time=scheduler.get_next_review_time(next_interval),
        )

        # Persist result (application specific)
        self.provider.save_review_result(result)

        # Record statistics
        self.stats.record_answer(quality)

        return result

    def next_card(self) -> Optional[ReviewCard]:
        """Move to next card"""
        self.current_index += 1
        return self.get_current_card()

    def is_complete(self) -> bool:
        """Check if session is complete"""
        return self.current_index >= len(self.cards)

    def get_progress(self) -> Dict:
        """Get current session progress"""
        total = len(self.cards)
        current = self.current_index + 1

        return {
            "current": current,
            "total": total,
            "percentage": (current / max(1, total)) * 100 if total > 0 else 0,
            "correct": self.stats.correct_count,
            "accuracy": self.stats.get_accuracy(),
        }

    def end_session(self) -> Dict:
        """End the session and return summary"""
        return self.stats.to_dict()
