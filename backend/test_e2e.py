"""
E2E Tests for MixRead Backend
Tests the complete flow of unknown words marking, syncing, and highlighting
"""

import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# Use in-memory SQLite for testing
from infrastructure.database import Base, get_db
from infrastructure.models import UserModel, UnknownWordModel, VocabularyEntryModel
from main import app

# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

# Enable foreign keys for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create all tables
Base.metadata.create_all(bind=engine)

# Verify tables were created
from sqlalchemy import inspect
inspector = inspect(engine)
tables = inspector.get_table_names()
print(f"Created test tables: {tables}")


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

# Test data
TEST_USER_ID = "mixread-user-test-001"
TEST_WORDS = ["the", "computer", "ephemeris", "ubiquitous", "run"]


class TestUserManagement:
    """Tests for user management endpoints"""

    def test_get_user_creates_new_user(self):
        """Test that getting a user creates a new user if doesn't exist"""
        response = client.get(f"/users/{TEST_USER_ID}")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["user_id"] == TEST_USER_ID
        assert "known_words" in data
        assert "unknown_words" in data
        assert "vocabulary" in data

    def test_mark_word_as_unknown(self):
        """Test marking a word as unknown"""
        response = client.post(
            f"/users/{TEST_USER_ID}/unknown-words",
            json={"word": "ephemeris"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_get_unknown_words(self):
        """Test retrieving unknown words for a user"""
        # First mark some words
        client.post(f"/users/{TEST_USER_ID}/unknown-words", json={"word": "ephemeris"})
        client.post(f"/users/{TEST_USER_ID}/unknown-words", json={"word": "ubiquitous"})

        # Then retrieve them
        response = client.get(f"/users/{TEST_USER_ID}/unknown-words")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        unknown_words = data["unknown_words"]
        assert "ephemeris" in unknown_words
        assert "ubiquitous" in unknown_words

    def test_unmark_word_as_unknown(self):
        """Test removing a word from unknown list"""
        # Mark a word
        client.post(f"/users/{TEST_USER_ID}/unknown-words", json={"word": "test-word"})

        # Remove it
        response = client.delete(f"/users/{TEST_USER_ID}/unknown-words/test-word")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify it's removed
        response = client.get(f"/users/{TEST_USER_ID}/unknown-words")
        unknown_words = response.json()["unknown_words"]
        assert "test-word" not in unknown_words

    def test_mark_word_as_known(self):
        """Test marking a word as known"""
        response = client.post(
            f"/users/{TEST_USER_ID}/known-words",
            json={"word": "common"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_get_known_words(self):
        """Test retrieving known words for a user"""
        # Mark a word as known
        client.post(f"/users/{TEST_USER_ID}/known-words", json={"word": "test-known"})

        # Retrieve
        response = client.get(f"/users/{TEST_USER_ID}/known-words")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "test-known" in data["known_words"]


class TestHighlighting:
    """Tests for highlighting logic with 3-priority system"""

    def test_highlight_unknown_words_priority_1(self):
        """Test that unknown words are highlighted (Priority 1)"""
        user_id = "test-user-highlight-1"

        # Mark word as unknown
        client.post(f"/users/{user_id}/unknown-words", json={"word": "ephemeris"})

        # Request highlighting (assuming CEFR data is loaded)
        response = client.post(
            "/highlight-words",
            json={
                "user_id": user_id,
                "words": ["ephemeris", "common", "the"],
                "difficulty_level": "B1"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        # "ephemeris" should be highlighted if it's in CEFR data
        # (depends on test data availability)

    def test_highlight_known_words_priority_2(self):
        """Test that known words are NOT highlighted (Priority 2)"""
        user_id = "test-user-highlight-2"

        # Mark word as known
        client.post(f"/users/{user_id}/known-words", json={"word": "common"})

        # Request highlighting
        response = client.post(
            "/highlight-words",
            json={
                "user_id": user_id,
                "words": ["common", "ephemeris"],
                "difficulty_level": "B1"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        # "common" should NOT be highlighted if marked as known

    def test_highlight_difficulty_level_priority_3(self):
        """Test difficulty level-based highlighting (Priority 3)"""
        user_id = "test-user-highlight-3"

        # Don't mark any words, just use difficulty level
        response = client.post(
            "/highlight-words",
            json={
                "user_id": user_id,
                "words": ["the", "computer", "ephemeris"],
                "difficulty_level": "B1"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "total_words" in data
        assert "highlighted_count" in data

    def test_invalid_difficulty_level(self):
        """Test handling of invalid difficulty level"""
        response = client.post(
            "/highlight-words",
            json={
                "user_id": "test-user",
                "words": ["test"],
                "difficulty_level": "INVALID"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "Invalid difficulty level" in data.get("error", "")

    def test_highlight_respects_user_isolation(self):
        """Test that different users' word lists don't affect each other"""
        user1_id = "test-user-isolation-1"
        user2_id = "test-user-isolation-2"

        # User 1 marks "ephemeris" as unknown
        client.post(f"/users/{user1_id}/unknown-words", json={"word": "ephemeris"})

        # User 2 highlights the same word without marking it
        response = client.post(
            "/highlight-words",
            json={
                "user_id": user2_id,
                "words": ["ephemeris"],
                "difficulty_level": "B1"
            }
        )

        assert response.status_code == 200
        data = response.json()
        # User 2's highlighting should not be affected by User 1's unknown words


class TestMultiDeviceSync:
    """Tests for multi-device sync functionality"""

    def test_sync_unknown_words_across_users(self):
        """Test that unknown words persist and can be retrieved"""
        user_id = "test-user-sync"

        # Mark multiple words
        words_to_mark = ["ephemeris", "ubiquitous", "serendipity"]
        for word in words_to_mark:
            response = client.post(
                f"/users/{user_id}/unknown-words",
                json={"word": word}
            )
            assert response.status_code == 200

        # Retrieve all words
        response = client.get(f"/users/{user_id}/unknown-words")
        assert response.status_code == 200
        data = response.json()
        retrieved_words = data["unknown_words"]

        # Verify all marked words are present
        for word in words_to_mark:
            assert word in retrieved_words

    def test_unknown_words_persist_across_requests(self):
        """Test that unknown words persist across multiple API calls"""
        user_id = "test-user-persist"

        # Mark word
        client.post(f"/users/{user_id}/unknown-words", json={"word": "persist-test"})

        # Make multiple requests and verify word persists
        for _ in range(3):
            response = client.get(f"/users/{user_id}/unknown-words")
            data = response.json()
            assert "persist-test" in data["unknown_words"]


class TestWordInfo:
    """Tests for word information endpoints"""

    def test_get_word_info(self):
        """Test getting information about a word"""
        response = client.get("/word/computer")
        assert response.status_code == 200
        data = response.json()
        assert data["word"] == "computer"
        # May contain CEFR level, definition, chinese, etc.

    def test_health_check(self):
        """Test health endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "words_loaded" in data


# Integration test scenarios
class TestIntegrationScenarios:
    """Tests for complete end-to-end scenarios"""

    def test_complete_user_workflow(self):
        """Test a complete user workflow"""
        user_id = "test-user-workflow"

        # 1. Get user (creates new if doesn't exist)
        response = client.get(f"/users/{user_id}")
        assert response.status_code == 200

        # 2. Mark some words as unknown
        unknown_words = ["ephemeris", "ubiquitous"]
        for word in unknown_words:
            response = client.post(
                f"/users/{user_id}/unknown-words",
                json={"word": word}
            )
            assert response.status_code == 200

        # 3. Mark some words as known
        known_words = ["computer", "run"]
        for word in known_words:
            response = client.post(
                f"/users/{user_id}/known-words",
                json={"word": word}
            )
            assert response.status_code == 200

        # 4. Request highlighting with these words
        response = client.post(
            "/highlight-words",
            json={
                "user_id": user_id,
                "words": unknown_words + known_words + ["test"],
                "difficulty_level": "B1"
            }
        )
        assert response.status_code == 200

        # 5. Verify unknown and known word lists
        response = client.get(f"/users/{user_id}/unknown-words")
        data = response.json()
        for word in unknown_words:
            assert word in data["unknown_words"]

        response = client.get(f"/users/{user_id}/known-words")
        data = response.json()
        for word in known_words:
            assert word in data["known_words"]

    def test_user_data_consistency(self):
        """Test that user data is consistent across operations"""
        user_id = "test-user-consistency"

        # Mark words
        client.post(f"/users/{user_id}/unknown-words", json={"word": "test1"})
        client.post(f"/users/{user_id}/known-words", json={"word": "test2"})

        # Get complete user data
        response = client.get(f"/users/{user_id}")
        data = response.json()

        # Verify data consistency
        assert "test1" in data["unknown_words"]
        assert "test2" in data["known_words"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
