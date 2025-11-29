"""
Application Services - Use Case Orchestration

Coordinates domain logic, infrastructure, and data access
Implements specific business use cases
"""

from typing import List, Dict, Optional
from domain.models import Word, User
from domain.services import HighlightService, DifficultyService
from infrastructure.repositories import UserRepository


class UserApplicationService:
    """
    User application service - coordinates user-related use cases
    """

    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    def mark_word_as_known(self, user_id: str, word: str):
        """
        Use case: User marks a word as known
        Returns the updated user
        """
        user = self.user_repository.get_user(user_id)
        user.add_known_word(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word marked as known"}

    def mark_word_as_unknown(self, user_id: str, word: str):
        """
        Use case: User marks a word as unknown/not knowing
        Returns the updated user
        """
        user = self.user_repository.get_user(user_id)
        user.add_unknown_word(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word marked as unknown"}

    def unmark_word_as_known(self, user_id: str, word: str):
        """
        Use case: User removes a word from known list
        """
        user = self.user_repository.get_user(user_id)
        user.remove_known_word(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word removed from known list"}

    def unmark_word_as_unknown(self, user_id: str, word: str):
        """
        Use case: User removes a word from unknown list
        """
        user = self.user_repository.get_user(user_id)
        user.remove_unknown_word(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word removed from unknown list"}

    def add_to_vocabulary(self, user_id: str, word: str):
        """
        Use case: User adds a word to vocabulary for learning
        """
        user = self.user_repository.get_user(user_id)
        user.add_to_vocabulary(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word added to vocabulary"}

    def remove_from_vocabulary(self, user_id: str, word: str):
        """
        Use case: User removes a word from vocabulary
        """
        user = self.user_repository.get_user(user_id)
        user.remove_from_vocabulary(word)
        self.user_repository.save_user(user)
        return {"success": True, "message": "Word removed from vocabulary"}

    def get_user_data(self, user_id: str):
        """
        Use case: Get user's complete data
        Returns known_words, unknown_words, and vocabulary
        """
        user = self.user_repository.get_user(user_id)
        return {
            "success": True,
            "user_id": user.user_id,
            "known_words": list(user.known_words),
            "unknown_words": list(user.unknown_words),
            "vocabulary": list(user.vocabulary.keys())
        }

    def get_known_words(self, user_id: str):
        """Get user's known words list"""
        words = self.user_repository.get_known_words(user_id)
        return {
            "success": True,
            "known_words": list(words)
        }

    def get_unknown_words(self, user_id: str):
        """Get user's unknown words list"""
        words = self.user_repository.get_unknown_words(user_id)
        return {
            "success": True,
            "unknown_words": list(words)
        }


class HighlightApplicationService:
    """
    Highlight application service - coordinates word highlighting logic
    """

    def __init__(self, user_repository: UserRepository, cefr_data: dict, chinese_dict: dict):
        self.user_repository = user_repository
        self.cefr_data = cefr_data
        self.chinese_dict = chinese_dict

    def get_highlighted_words(
        self,
        user_id: str,
        words: List[str],
        difficulty_level: str
    ) -> Dict:
        """
        Use case: Get words that should be highlighted based on:
        1. user_id's known_words and unknown_words
        2. difficulty_level
        3. availability of Chinese translation
        """
        # Validate difficulty level
        if not DifficultyService.is_valid_level(difficulty_level):
            return {
                "success": False,
                "error": f"Invalid difficulty level: {difficulty_level}"
            }

        # Load user data
        user = self.user_repository.get_user(user_id)

        highlighted = []
        word_details = []

        for word_text in words:
            word_lower = word_text.lower()

            # Skip if not in CEFR database
            if word_lower not in self.cefr_data:
                continue

            word_info = self.cefr_data[word_lower]
            word = Word(word_text, word_info.get("cefr_level", "A1"))

            # Check if should highlight using domain logic
            if HighlightService.should_highlight(
                word,
                difficulty_level,
                user.known_words,
                user.unknown_words
            ):
                # Only highlight if has Chinese translation
                chinese = self.chinese_dict.get(word_lower)
                if chinese:
                    highlighted.append(word_text)
                    word_details.append({
                        "word": word_text,
                        "cefr_level": word_info.get("cefr_level"),
                        "pos": word_info.get("pos"),
                        "chinese": chinese
                    })

        return {
            "success": True,
            "difficulty_level": difficulty_level,
            "total_words": len(words),
            "highlighted_count": len(highlighted),
            "highlighted_words": highlighted,
            "word_details": word_details
        }
