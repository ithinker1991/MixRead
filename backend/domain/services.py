"""
Domain Services - Core business logic

Contains pure business rules for word highlighting, difficulty checking, etc.
No dependencies on infrastructure or ORM
"""

from domain.models import Word


class HighlightService:
    """
    Core service for determining which words should be highlighted

    Priority:
    1. unknown_words - explicit "I don't know this word" → highlight
    2. known_words - explicit "I know this word" → don't highlight
    3. difficulty_level - default rule based on CEFR level
    """

    @staticmethod
    def should_highlight(
        word: Word,
        user_difficulty_level: str,
        known_words: set,
        unknown_words: set
    ) -> bool:
        """
        Determine if a word should be highlighted

        Args:
            word: Word object with CEFR level
            user_difficulty_level: User's difficulty setting (A1-C2)
            known_words: Set of words user marked as knowing
            unknown_words: Set of words user marked as not knowing

        Returns:
            bool: True if word should be highlighted, False otherwise
        """
        word_text = word.text.lower()

        # Priority 1: User explicitly marked as not knowing
        if word_text in unknown_words:
            return True

        # Priority 2: User explicitly marked as knowing
        if word_text in known_words:
            return False

        # Priority 3: Default difficulty-based rule
        return HighlightService._check_difficulty_level(word, user_difficulty_level)

    @staticmethod
    def _check_difficulty_level(word: Word, user_difficulty_level: str) -> bool:
        """
        Check if word difficulty meets user's level

        Args:
            word: Word object
            user_difficulty_level: User's difficulty setting

        Returns:
            bool: True if word_difficulty >= user_difficulty, False otherwise
        """
        CEFR_RANKS = {
            "A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6
        }

        word_rank = word.get_difficulty_rank()
        user_rank = CEFR_RANKS.get(user_difficulty_level, 3)

        return word_rank >= user_rank

    @staticmethod
    def should_highlight_mrs(
        word: Word,
        user_mrs_threshold: int,
        known_words: set,
        unknown_words: set
    ) -> bool:
        """
        Determine if a word should be highlighted based on MRS (MixRead Score)
        
        Logic:
            If word.mrs >= user_mrs_threshold, highlight it.
            This means user knows words BELOW this threshold.
            
        Args:
            word: Word object (must have .mrs attribute injected)
            user_mrs_threshold: User's MRS difficulty setting (0-100)
            known_words: Set of words user marked as knowing
            unknown_words: Set of words user marked as not knowing
            
        Returns:
            bool: True if word should be highlighted
        """
        word_text = word.text.lower()

        # Priority 1: User explicitly marked as unknown
        if word_text in unknown_words:
            return True

        # Priority 2: User explicitly marked as knowing
        if word_text in known_words:
            return False

        # Priority 3: MRS Comparison
        # Default to 100 (hardest) if MRS is missing
        word_mrs = getattr(word, 'mrs', 100)
        
        return word_mrs >= user_mrs_threshold


class DifficultyService:
    """Service for handling difficulty-related operations"""

    CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]
    DEFAULT_DIFFICULTY = "B1"

    @classmethod
    def is_valid_level(cls, level: str) -> bool:
        """Check if difficulty level is valid"""
        return level in cls.CEFR_LEVELS

    @classmethod
    def get_level_rank(cls, level: str) -> int:
        """Get numeric rank for difficulty level"""
        return cls.CEFR_LEVELS.index(level) + 1 if level in cls.CEFR_LEVELS else 0
