"""
Automated E2E Test for Unified Learning System
Tests the complete lifecycle of a word encountering, collection, and SRS review.
"""

# --- Test Environment Setup ---
import os
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from infrastructure.database import Base, get_db
from infrastructure.models import (
    DomainManagementPolicy,
    UnknownWordModel,
    UserModel,
    VocabularyEntryModel,
    VocabularyStatus,
)
from main import app
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_FILE = "test_unified.db"
if os.path.exists(TEST_DB_FILE):
    os.remove(TEST_DB_FILE)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

# --- Constants ---
USER_ID = "e2e_test_user"
WORD = "serendipity"
CONTEXT = {
    "sentence": "The discovery of penicillin was a happy serendipity.",
    "url": "https://example.com/science",
    "page_title": "Scientific Discoveries"
}

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    yield TestingSessionLocal()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def client(db):
    with TestClient(app) as c:
        yield c

# --- Test Cases ---

def test_unified_learning_lifecycle(client):
    """
    Complete lifecycle test: Add to Library -> Verify Unified Storage -> Review -> Verify Progress
    Matches User Story 1 & 2
    """
    
    # 1. Add word with context to Library
    print(f"\n[TC1] Adding '{WORD}' to library...")
    add_response = client.post(
        f"/users/{USER_ID}/library",
        json={
            "words": [WORD],
            "contexts": [CONTEXT]
        }
    )
    assert add_response.status_code == 200
    assert add_response.json()["success"] is True

    # 2. Verify Unified Storage (Check Database directly or via API)
    print("[TC2] Verifying unified storage...")
    # Via API: get_library
    lib_response = client.get(f"/users/{USER_ID}/library")
    assert lib_response.status_code == 200
    library = lib_response.json()["library"]
    
    entry = next((item for item in library if item["word"] == WORD), None)
    assert entry is not None
    assert entry["status"] == "learning" # Initial status
    assert len(entry["contexts"]) == 1
    assert entry["contexts"][0]["sentence"] == CONTEXT["sentence"]

    # 3. Verify it appears in Review Session (NEW queue)
    print("[TC3] Checking if word is in review session...")
    session_response = client.post(
        f"/users/{USER_ID}/review/session",
        json={"session_type": "new"}
    )
    assert session_response.status_code == 200
    session_data = session_response.json()
    assert session_data["total_cards"] >= 1
    
    # Check if our word is the first card
    first_card = session_data["first_card"]
    assert first_card["content"]["word"] == WORD
    session_id = session_data["session_id"]

    # 4. Submit a Review Answer (Quality 5 - Perfect)
    print("[TC4] Submitting perfect review result...")
    # Note: Using query parameters as per backend/api/review.py answer endpoint
    answer_response = client.post(
        f"/users/{USER_ID}/review/answer?session_id={session_id}&quality=5"
    )
    assert answer_response.status_code == 200
    assert answer_response.json()["success"] is True

    # 5. Verify State Sync (Library should reflect SRS status)
    print("[TC5] Verifying state synchronization in Library view...")
    lib_sync_response = client.get(f"/users/{USER_ID}/library")
    library_updated = lib_sync_response.json()["library"]
    updated_entry = next((item for item in library_updated if item["word"] == WORD), None)
    
    # Status should have moved to REVIEWING or interval should be updated
    assert updated_entry["status"] == "reviewing"
    
    # 6. Delete Unification
    print("[TC6] Verifying delete unification...")
    del_response = client.delete(f"/users/{USER_ID}/library/{WORD}")
    assert del_response.status_code == 200
    
    # Check library empty
    lib_empty_response = client.get(f"/users/{USER_ID}/library")
    assert len(lib_empty_response.json()["library"]) == 0
    
    # Check review session: our word should NOT be present among the cards
    session_response = client.post(
        f"/users/{USER_ID}/review/session",
        json={"session_type": "new"}
    )
    if session_response.status_code == 200:
        data = session_response.json()
        if data.get("success"):
            # If there's a card, it shouldn't be our word
            assert data["first_card"]["content"]["word"] != WORD

    print("✅ Unified Learning System E2E Test Passed!")

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
