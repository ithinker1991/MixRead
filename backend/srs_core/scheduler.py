"""
Spaced Repetition Scheduler - Pure algorithm, no side effects

Implements a simplified SM-2 algorithm for calculating review intervals
and difficulty factors.

Key principle: This is a pure function. It doesn't know about databases,
applications, or specific domain models. It only does math.
"""

from datetime import datetime, timedelta
from typing import Tuple


class SpacedRepetitionEngine:
    """
    Pure SRS algorithm implementation

    Based on SM-2 algorithm but simplified for practical use.
    No side effects: input parameters → calculation → return values
    """

    def __init__(self):
        """Initialize with SM-2 constants"""
        self.initial_interval = 1  # First review after 1 hour
        self.min_ease_factor = 1.3
        self.initial_ease = 2.5

    def calculate_interval(
        self,
        current_interval: int,
        quality: int,
        ease_factor: float,
    ) -> Tuple[int, float]:
        """
        Calculate next review interval and new ease factor

        Pure function: no database access, no side effects

        Args:
            current_interval: Current interval in hours
            quality: Quality of recall (0-5)
            ease_factor: Current difficulty factor

        Returns:
            (next_interval_hours, new_ease_factor)

        Quality scale (0-5):
            0: Complete blackout / incorrect
            1: Incorrect but recognized / has some memory
            2: Incorrect but easy to recall
            3: Correct with significant hesitation
            4: Correct but needed some thinking
            5: Perfect / immediate recall
        """
        # Calculate new ease factor based on quality
        # Formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        ease_delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
        new_ease = max(self.min_ease_factor, ease_factor + ease_delta)

        # Calculate interval based on quality
        if quality < 3:
            # Incorrect or unsure - reset to beginning
            next_interval = self.initial_interval * 24  # 1 hour in our system
        else:
            # Correct answer - increase interval
            if current_interval == 0:
                # First review
                next_interval = 1 * 24  # 1 day
            elif current_interval == 24:
                # Second review (24 hours / 24 = 1 day)
                next_interval = 3 * 24  # 3 days
            else:
                # Subsequent reviews
                next_interval = int(current_interval * new_ease)

        return next_interval, new_ease  # Return in hours

    def get_next_review_time(self, interval_hours: int) -> datetime:
        """
        Calculate absolute time for next review

        Args:
            interval_hours: Interval in hours

        Returns:
            Datetime of next review
        """
        return datetime.now() + timedelta(hours=interval_hours)

    def calculate_status_update(
        self,
        total_reviews: int,
        correct_reviews: int,
        review_streak: int,
        current_interval: int,
    ) -> str:
        """
        Determine learning status based on progress

        Args:
            total_reviews: Total number of reviews
            correct_reviews: Number of correct answers
            review_streak: Current consecutive correct answers
            current_interval: Current review interval in hours

        Returns:
            Status string: "learning", "reviewing", or "mastered"
        """
        if total_reviews == 0:
            return "learning"

        # Mastered: 5+ correct streak AND 1+ week interval
        if review_streak >= 5 and current_interval >= 7 * 24:
            return "mastered"

        # Otherwise: reviewing (has been reviewed before)
        if total_reviews > 0:
            return "reviewing"

        return "learning"
