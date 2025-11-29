#!/usr/bin/env python3
"""
Basic smoke test to verify DDD architecture works

Tests core domain logic without database
"""

from domain.models import Word, User, VocabularyEntry
from domain.services import HighlightService, DifficultyService


def test_word_model():
    """Test Word entity"""
    word = Word("beautiful", "B1")
    assert word.text == "beautiful"
    assert word.cefr_level == "B1"
    assert word.get_difficulty_rank() == 3
    print("✓ Word model works")


def test_user_model():
    """Test User entity"""
    user = User("test-user-001")

    # Test adding known word
    user.add_known_word("good")
    assert "good" in user.known_words
    print("✓ User can add known words")

    # Test adding unknown word
    user.add_unknown_word("ephemeris")
    assert "ephemeris" in user.unknown_words
    assert "ephemeris" not in user.known_words
    print("✓ User can add unknown words")

    # Test vocabulary
    user.add_to_vocabulary("serendipity")
    assert "serendipity" in user.vocabulary
    print("✓ User can add to vocabulary")


def test_highlight_service():
    """Test highlighting logic"""
    word = Word("beautiful", "B1")
    known_words = set()
    unknown_words = set()

    # Default case: should highlight
    assert HighlightService.should_highlight(word, "B1", known_words, unknown_words) == True
    print("✓ Default highlight logic works")

    # Mark as known: should not highlight
    known_words.add("beautiful")
    assert HighlightService.should_highlight(word, "B1", known_words, unknown_words) == False
    print("✓ Known words are not highlighted")

    # Mark as unknown: should highlight even if marked as known
    known_words.discard("beautiful")
    unknown_words.add("beautiful")
    assert HighlightService.should_highlight(word, "B1", known_words, unknown_words) == True
    print("✓ Unknown words are highlighted (priority)")


def test_difficulty_service():
    """Test difficulty level handling"""
    assert DifficultyService.is_valid_level("B1") == True
    assert DifficultyService.is_valid_level("INVALID") == False
    assert DifficultyService.get_level_rank("B1") == 3
    print("✓ Difficulty service works")


if __name__ == "__main__":
    print("\n🧪 Running basic smoke tests...\n")
    test_word_model()
    test_user_model()
    test_highlight_service()
    test_difficulty_service()
    print("\n✅ All basic tests passed!\n")
