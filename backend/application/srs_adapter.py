"""
SRS Adapter for MixRead

Bridges between MixRead domain models and the SRS core library.
This is the key to keeping the core library application-agnostic.

Architecture:
  MixRead models (VocabularyEntryModel)
         ↓
  VocabularyReviewProvider (this file)
         ↓
  SRS Core Library (SpacedRepetitionEngine, ReviewSession, etc.)
"""

from datetime import datetime
from typing import List, Optional

from infrastructure.models import VocabularyEntryModel
from infrastructure.repositories import VocabularyRepository
from srs_core.models import (
    LearningItem,
    LearningStatus,
    ReviewProvider,
    ReviewResult,
)


class AdaptedVocabularyItem(LearningItem):
    """
    Adapter: VocabularyEntryModel → LearningItem

    Converts MixRead's database model to the SRS core library's interface.
    The SRS core library never knows about VocabularyEntryModel directly.
    """

    def __init__(self, model: VocabularyEntryModel):
        self.model = model
        self.item_id = str(model.id)
        self.user_id = model.user_id
        self.created_at = model.added_at

        # Map MixRead VocabularyStatus to SRS LearningStatus
        self.status = self._map_status(model.status)

        # Content - what the SRS engine learns about
        self.content = {
            "word": model.word,
            "added_at": model.added_at.isoformat() if model.added_at else None,
        }

        # SRS fields
        self.review_interval = model.review_interval
        self.ease_factor = model.ease_factor

    def _map_status(self, mixread_status) -> LearningStatus:
        """Map MixRead VocabularyStatus to SRS LearningStatus"""
        from domain.models import VocabularyStatus

        # Map based on status and review timing
        if self.model.next_review and datetime.now() > self.model.next_review:
            return LearningStatus.DUE
        elif mixread_status == VocabularyStatus.MASTERED:
            return LearningStatus.MASTERED
        elif mixread_status == VocabularyStatus.REVIEWING:
            return LearningStatus.REVIEWING
        else:
            return LearningStatus.LEARNING

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "item_id": self.item_id,
            "word": self.content["word"],
            "status": self.status.value,
            "review_interval": self.review_interval,
            "ease_factor": self.ease_factor,
        }


class VocabularyReviewProvider(ReviewProvider):
    """
    MixRead's implementation of ReviewProvider

    This connects the SRS core library to MixRead's data persistence layer.
    The SRS core library only knows about this interface, not the details.

    Key principle: ReviewProvider is the boundary between application logic
    and the reusable SRS core library.
    """

    def __init__(self, vocabulary_repo: VocabularyRepository):
        self.vocabulary_repo = vocabulary_repo

    def get_item_by_id(self, item_id: str) -> Optional[LearningItem]:
        """
        Get a single item by ID

        The SRS core library calls this to fetch items during review.
        """
        model = self.vocabulary_repo.get_by_id(item_id)
        if not model:
            return None
        return AdaptedVocabularyItem(model)

    def get_items_by_status(
        self, status: LearningStatus, limit: int = 20
    ) -> List[LearningItem]:
        """
        Get items filtered by status

        The SRS core library calls this to build review sessions.
        """
        from domain.models import VocabularyStatus

        # Map SRS status to MixRead status and retrieve
        if status == LearningStatus.DUE:
            # Get items that are due for review (next_review <= now)
            models = self.vocabulary_repo.get_due_for_review(
                limit=limit
            )
        elif status == LearningStatus.NEW:
            # Get new words (never reviewed before)
            models = self.vocabulary_repo.get_new_words(limit=limit)
        elif status == LearningStatus.LEARNING:
            models = self.vocabulary_repo.get_by_status(
                VocabularyStatus.LEARNING, limit=limit
            )
        elif status == LearningStatus.REVIEWING:
            models = self.vocabulary_repo.get_by_status(
                VocabularyStatus.REVIEWING, limit=limit
            )
        elif status == LearningStatus.MASTERED:
            models = self.vocabulary_repo.get_by_status(
                VocabularyStatus.MASTERED, limit=limit
            )
        else:
            models = []

        return [AdaptedVocabularyItem(m) for m in models]

    def save_review_result(self, result: ReviewResult) -> None:
        """
        Persist the result of a review

        Called by ReviewSession after each review submission.
        The SRS core library computes the result; we apply it to the database.
        """
        # Fetch the original model
        model = self.vocabulary_repo.get_by_id(result.item_id)
        if not model:
            return

        # Update SRS fields from the result
        model.review_interval = result.new_interval
        model.ease_factor = result.new_ease
        model.next_review = result.next_review_time
        model.last_reviewed = datetime.now()
        model.total_reviews += 1
        model.last_review_quality = result.quality

        # Update MixRead-specific business logic
        if result.quality >= 3:
            # Correct answer
            model.correct_reviews += 1
            model.review_streak += 1
        else:
            # Incorrect answer
            model.review_streak = 0

        # Update status based on progress
        self._update_status(model)

        # Save to database
        self.vocabulary_repo.update(model)

    def _update_status(self, model: VocabularyEntryModel) -> None:
        """
        Update the vocabulary status based on SRS progress

        This is MixRead-specific business logic that uses SRS data.
        """
        from domain.models import VocabularyStatus

        if model.review_streak >= 5 and model.review_interval >= 7 * 24:
            # 5+ consecutive correct answers AND 7+ days interval = mastered
            model.status = VocabularyStatus.MASTERED
        elif model.total_reviews > 0:
            # Has been reviewed before
            model.status = VocabularyStatus.REVIEWING
        else:
            # Never reviewed
            model.status = VocabularyStatus.LEARNING
