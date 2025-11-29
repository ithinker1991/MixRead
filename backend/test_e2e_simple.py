"""
Simplified E2E Tests for MixRead Backend
Tests core workflows without complex database setup
"""

import pytest
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from infrastructure.database import Base
from infrastructure.models import UserModel, UnknownWordModel
from infrastructure.repositories import UserRepository
from application.services import UserApplicationService, HighlightApplicationService
from domain.models import User, Word
from domain.services import HighlightService, DifficultyService

# Create in-memory test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

# Test data
TEST_USER_ID = "test-user-001"
TEST_WORDS = ["ephemeris", "ubiquitous", "serendipity"]


class TestDomainLayer:
    """Tests for domain layer logic"""

    def test_highlight_service_priority_1_unknown_word(self):
        """Test Priority 1: unknown words are highlighted"""
        word = Word("ephemeris", "C2")
        unknown_words = {"ephemeris"}
        known_words = set()
        difficulty = "B1"

        result = HighlightService.should_highlight(
            word, difficulty, known_words, unknown_words
        )
        assert result is True, "Unknown words should be highlighted (Priority 1)"

    def test_highlight_service_priority_2_known_word(self):
        """Test Priority 2: known words are NOT highlighted"""
        word = Word("computer", "A2")
        unknown_words = set()
        known_words = {"computer"}
        difficulty = "B1"

        result = HighlightService.should_highlight(
            word, difficulty, known_words, unknown_words
        )
        assert result is False, "Known words should NOT be highlighted (Priority 2)"

    def test_highlight_service_priority_3_difficulty_level(self):
        """Test Priority 3: difficulty level determines highlighting"""
        # Word at C2 level, user at B1
        word_hard = Word("ephemeris", "C2")
        unknown_words = set()
        known_words = set()
        difficulty = "B1"

        result = HighlightService.should_highlight(
            word_hard, difficulty, known_words, unknown_words
        )
        assert result is True, "Words harder than user level should be highlighted (Priority 3)"

        # Word at A1 level, user at B1
        word_easy = Word("the", "A1")
        result = HighlightService.should_highlight(
            word_easy, difficulty, known_words, unknown_words
        )
        assert result is False, "Words easier than user level should NOT be highlighted"

    def test_user_model_add_unknown_word(self):
        """Test User model can track unknown words"""
        user = User(TEST_USER_ID)
        user.add_unknown_word("ephemeris")
        user.add_unknown_word("ubiquitous")

        assert "ephemeris" in user.unknown_words
        assert "ubiquitous" in user.unknown_words
        assert len(user.unknown_words) == 2

    def test_user_model_add_known_word(self):
        """Test User model can track known words"""
        user = User(TEST_USER_ID)
        user.add_known_word("computer")
        user.add_known_word("run")

        assert "computer" in user.known_words
        assert "run" in user.known_words

    def test_difficulty_service_valid_levels(self):
        """Test difficulty level validation"""
        valid_levels = ["A1", "A2", "B1", "B2", "C1", "C2"]
        for level in valid_levels:
            assert DifficultyService.is_valid_level(level), f"{level} should be valid"

        invalid_levels = ["A0", "D1", "INVALID", ""]
        for level in invalid_levels:
            assert not DifficultyService.is_valid_level(level), f"{level} should be invalid"


class TestRepositoryLayer:
    """Tests for repository and persistence layer"""

    def test_user_repository_create_user(self):
        """Test creating and saving a new user"""
        db = TestingSessionLocal()
        repo = UserRepository(db)

        # Create user
        user = repo.get_user(TEST_USER_ID)
        assert user.user_id == TEST_USER_ID
        assert len(user.unknown_words) == 0
        assert len(user.known_words) == 0

        # Verify user was created in database
        user_model = db.query(UserModel).filter(UserModel.user_id == TEST_USER_ID).first()
        assert user_model is not None
        assert user_model.user_id == TEST_USER_ID

        db.close()

    def test_unknown_words_persistence(self):
        """Test unknown words persist in database"""
        db = TestingSessionLocal()
        repo = UserRepository(db)

        user_id = "test-persist-001"

        # Add unknown words
        user = repo.get_user(user_id)
        user.add_unknown_word("ephemeris")
        user.add_unknown_word("ubiquitous")
        repo.save_user(user)

        # Retrieve again and verify
        db2 = TestingSessionLocal()
        repo2 = UserRepository(db2)
        user_retrieved = repo2.get_user(user_id)

        assert "ephemeris" in user_retrieved.unknown_words
        assert "ubiquitous" in user_retrieved.unknown_words

        db.close()
        db2.close()

    def test_get_unknown_words_list(self):
        """Test retrieving unknown words list"""
        db = TestingSessionLocal()
        repo = UserRepository(db)

        user_id = "test-list-001"
        words = ["ephemeris", "ubiquitous", "serendipity"]

        # Add words
        user = repo.get_user(user_id)
        for word in words:
            user.add_unknown_word(word)
        repo.save_user(user)

        # Retrieve list
        retrieved_words = repo.get_unknown_words(user_id)
        assert len(retrieved_words) == 3
        for word in words:
            assert word in retrieved_words

        db.close()


class TestApplicationLayer:
    """Tests for application services"""

    def test_user_application_service_mark_unknown(self):
        """Test marking a word as unknown via service"""
        db = TestingSessionLocal()
        service = UserApplicationService(UserRepository(db))

        user_id = "test-service-001"
        result = service.mark_word_as_unknown(user_id, "ephemeris")

        assert result["success"] is True
        assert "Word marked as unknown" in result["message"]

        # Verify it was saved
        unknown_words = service.get_unknown_words(user_id)
        assert "ephemeris" in unknown_words["unknown_words"]

        db.close()

    def test_user_application_service_mark_known(self):
        """Test marking a word as known via service"""
        db = TestingSessionLocal()
        service = UserApplicationService(UserRepository(db))

        user_id = "test-service-known-001"
        result = service.mark_word_as_known(user_id, "computer")

        assert result["success"] is True

        # Verify it was saved
        known_words = service.get_known_words(user_id)
        assert "computer" in known_words["known_words"]

        db.close()

    def test_unmark_word_as_unknown(self):
        """Test removing a word from unknown list"""
        db = TestingSessionLocal()
        service = UserApplicationService(UserRepository(db))

        user_id = "test-unmark-001"

        # Mark as unknown first
        service.mark_word_as_unknown(user_id, "ephemeris")

        # Verify it's there
        result = service.get_unknown_words(user_id)
        assert "ephemeris" in result["unknown_words"]

        # Unmark it
        unmark_result = service.unmark_word_as_unknown(user_id, "ephemeris")
        assert unmark_result["success"] is True

        # Verify it's removed
        result = service.get_unknown_words(user_id)
        assert "ephemeris" not in result["unknown_words"]

        db.close()


class TestIntegrationScenarios:
    """Integration tests for complete workflows"""

    def test_complete_user_workflow(self):
        """Test complete unknown words workflow"""
        db = TestingSessionLocal()
        service = UserApplicationService(UserRepository(db))

        user_id = "test-workflow-001"

        # Step 1: Mark some words as unknown
        for word in TEST_WORDS:
            service.mark_word_as_unknown(user_id, word)

        # Step 2: Mark some words as known
        service.mark_word_as_known(user_id, "computer")
        service.mark_word_as_known(user_id, "run")

        # Step 3: Verify unknown words
        unknown = service.get_unknown_words(user_id)
        assert len(unknown["unknown_words"]) == len(TEST_WORDS)
        for word in TEST_WORDS:
            assert word in unknown["unknown_words"]

        # Step 4: Verify known words
        known = service.get_known_words(user_id)
        assert len(known["known_words"]) == 2
        assert "computer" in known["known_words"]
        assert "run" in known["known_words"]

        # Step 5: Remove a word from unknown
        service.unmark_word_as_unknown(user_id, TEST_WORDS[0])
        unknown = service.get_unknown_words(user_id)
        assert TEST_WORDS[0] not in unknown["unknown_words"]
        assert len(unknown["unknown_words"]) == len(TEST_WORDS) - 1

        db.close()

    def test_multi_user_isolation(self):
        """Test that different users' data doesn't mix"""
        db = TestingSessionLocal()
        service = UserApplicationService(UserRepository(db))

        # User 1 marks words
        service.mark_word_as_unknown("user-1", "ephemeris")
        service.mark_word_as_unknown("user-1", "ubiquitous")

        # User 2 marks different words
        service.mark_word_as_unknown("user-2", "test-word")

        # Verify isolation
        user1_words = service.get_unknown_words("user-1")["unknown_words"]
        user2_words = service.get_unknown_words("user-2")["unknown_words"]

        assert len(user1_words) == 2
        assert len(user2_words) == 1
        assert "ephemeris" not in user2_words
        assert "test-word" not in user1_words

        db.close()


# Test summary
if __name__ == "__main__":
    print("\n" + "="*70)
    print("MixRead Backend E2E Tests - Simplified")
    print("="*70 + "\n")
    pytest.main([__file__, "-v", "--tb=short"])
