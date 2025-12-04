"""
Unit tests for SpacedRepetitionEngine

Tests the pure SRS algorithm with no external dependencies.
"""

import pytest
from datetime import datetime, timedelta
from srs_core.scheduler import SpacedRepetitionEngine


class TestSpacedRepetitionEngine:
    """Test SM-2 algorithm implementation"""

    @pytest.fixture
    def engine(self):
        """Create fresh engine for each test"""
        return SpacedRepetitionEngine()

    def test_initialization(self, engine):
        """Test engine initialization"""
        assert engine.initial_interval == 1
        assert engine.min_ease_factor == 1.3
        assert engine.initial_ease == 2.5

    def test_first_review_perfect(self, engine):
        """First review with perfect recall"""
        # First review (interval = 0), perfect recall (quality = 5)
        interval, ease = engine.calculate_interval(0, 5, 2.5)

        # Should return 24 hours (1 day) * 24
        assert interval == 24
        # Ease factor should increase slightly
        assert ease > 2.5

    def test_first_review_poor(self, engine):
        """First review with poor recall"""
        # First review, poor recall (quality = 0)
        interval, ease = engine.calculate_interval(0, 0, 2.5)

        # Should reset to 1 hour
        assert interval == 24  # 1 hour * 24
        # Ease factor should decrease
        assert ease < 2.5

    def test_second_review_perfect(self, engine):
        """Second review with perfect recall"""
        # After first review, interval should be 1 day = 24 hours
        # Now doing second review with perfect recall
        interval, ease = engine.calculate_interval(24, 5, 2.5)

        # Should increase to 3 days
        assert interval == 72  # 3 days * 24 hours
        assert ease > 2.5

    def test_third_review_perfect(self, engine):
        """Third+ review with perfect recall"""
        # Interval: 72 hours (3 days), ease: 2.5, quality: 5
        interval, ease = engine.calculate_interval(72, 5, 2.5)

        # With perfect quality (5), ease factor increases
        # New ease ≈ 2.5 + 0.1 = 2.6
        # So interval ≈ 72 * 2.6 = 187 hours
        assert interval > 180  # More than 180 due to ease increase
        assert interval < 200  # But not too much
        assert ease > 2.5

    def test_incorrect_answer_resets(self, engine):
        """Incorrect answer should reset interval"""
        # Regardless of current interval, incorrect answer resets
        for current_interval in [24, 72, 168]:  # 1 day, 3 days, 7 days
            interval, ease = engine.calculate_interval(current_interval, 1, 2.5)
            assert interval == 24  # Reset to 1 hour
            assert ease < 2.5  # Ease factor decreases

    def test_ease_factor_bounds(self, engine):
        """Ease factor should not go below minimum"""
        # Multiple incorrect answers
        ease = 2.5
        for _ in range(10):
            _, ease = engine.calculate_interval(1, 0, ease)

        # Should never go below 1.3
        assert ease >= 1.3

    def test_quality_scale(self, engine):
        """Test all quality values (0-5)"""
        for quality in range(6):
            interval, ease = engine.calculate_interval(24, quality, 2.5)

            # Interval should be positive
            assert interval > 0
            # Ease should be within reasonable bounds
            assert ease >= 1.3
            assert ease <= 4.0  # arbitrary upper bound

    def test_ease_progression_with_perfect_answers(self, engine):
        """Ease factor should increase with consecutive perfect answers"""
        ease = 2.5
        previous_ease = ease

        for _ in range(5):
            _, ease = engine.calculate_interval(1, 5, ease)
            # Ease should increase with perfect answers
            assert ease >= previous_ease
            previous_ease = ease

    def test_get_next_review_time(self, engine):
        """Test calculation of absolute review time"""
        before = datetime.now()
        next_time = engine.get_next_review_time(24)  # 1 day
        after = datetime.now()

        # Next review should be roughly 1 day from now
        expected = before + timedelta(hours=24)
        assert next_time >= expected - timedelta(seconds=1)
        assert next_time <= after + timedelta(hours=24, seconds=1)

    def test_status_update_learning(self, engine):
        """Test status calculation for learning items"""
        # New item: 0 reviews
        status = engine.calculate_status_update(
            total_reviews=0,
            correct_reviews=0,
            review_streak=0,
            current_interval=0,
        )
        assert status == "learning"

    def test_status_update_reviewing(self, engine):
        """Test status calculation for items being reviewed"""
        # Has been reviewed but not mastered
        status = engine.calculate_status_update(
            total_reviews=3,
            correct_reviews=2,
            review_streak=2,
            current_interval=72,  # 3 days
        )
        assert status == "reviewing"

    def test_status_update_mastered(self, engine):
        """Test status calculation for mastered items"""
        # 5+ correct streak AND 7+ day interval
        status = engine.calculate_status_update(
            total_reviews=10,
            correct_reviews=9,
            review_streak=5,
            current_interval=7 * 24,  # 7 days
        )
        assert status == "mastered"

    def test_algorithm_consistency(self, engine):
        """Test that algorithm is deterministic"""
        # Same inputs should give same outputs
        result1 = engine.calculate_interval(24, 5, 2.5)
        result2 = engine.calculate_interval(24, 5, 2.5)

        assert result1 == result2

    def test_realistic_study_sequence(self, engine):
        """Test a realistic sequence of reviews"""
        interval = 0
        ease = 2.5

        # Day 1: First review, perfect
        interval, ease = engine.calculate_interval(interval, 5, ease)
        assert interval == 24  # 1 day

        # Day 2: Second review, perfect
        interval, ease = engine.calculate_interval(interval, 5, ease)
        assert interval == 72  # 3 days

        # Day 5: Third review, perfect
        interval, ease = engine.calculate_interval(interval, 5, ease)
        assert interval > 72  # More than 3 days

        # Day 100: Fourth review, good (not perfect)
        interval, ease = engine.calculate_interval(interval, 4, ease)
        assert interval > 0

        # Day 200: Fifth review, poor
        interval, ease = engine.calculate_interval(interval, 1, ease)
        assert interval == 24  # Reset to 1 day

    def test_interval_hours_conversion(self, engine):
        """Test that intervals are correctly converted to hours"""
        # 0 quality → 1 hour = 24 in our system (wait, this seems off)
        # Let me check the algorithm...
        interval, _ = engine.calculate_interval(0, 5, 2.5)
        # Should be 1 * 24 = 24
        assert interval == 24


class TestEdgeCases:
    """Test edge cases and boundary conditions"""

    @pytest.fixture
    def engine(self):
        return SpacedRepetitionEngine()

    def test_zero_interval_input(self, engine):
        """Test with zero interval (new item)"""
        interval, ease = engine.calculate_interval(0, 3, 2.5)
        assert interval > 0

    def test_very_large_interval(self, engine):
        """Test with very large interval"""
        # 365 days
        large_interval = 365 * 24
        interval, ease = engine.calculate_interval(large_interval, 5, 2.5)
        # Should still calculate without errors
        assert interval > large_interval

    def test_extreme_ease_factor(self, engine):
        """Test with extreme ease factor"""
        # Very high ease factor
        interval, ease = engine.calculate_interval(24, 5, 10.0)
        assert ease <= 10.1  # Should not increase too much

        # Very low ease factor (at minimum)
        interval, ease = engine.calculate_interval(24, 0, 1.3)
        assert ease >= 1.3  # Should not go below minimum

    def test_quality_boundary_values(self, engine):
        """Test quality values at boundaries"""
        # Quality exactly at 3 (threshold for "correct")
        interval, ease = engine.calculate_interval(1, 3, 2.5)
        # Should not reset (quality >= 3)
        assert interval > 1

        # Quality just below 3
        interval, ease = engine.calculate_interval(1, 2, 2.5)
        # Should reset (quality < 3)
        assert interval == 1 * 24
