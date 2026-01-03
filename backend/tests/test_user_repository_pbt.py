"""
Property-Based Tests for UserRepository

Tests the round-trip property for user creation and retrieval with Google info.

**Property 1: User Creation/Retrieval Round-Trip**
**Validates: Requirements 2.4, 6.1, 6.2, 6.3**

For any valid Google user info (google_id, email, avatar_url), if the AuthService 
creates a user and then retrieves by the same google_id, the returned user should 
have the same google_id, email, and avatar_url.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st
from infrastructure.database import Base
from infrastructure.repositories import UserRepository
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Strategies for generating valid Google user data
google_id_strategy = st.text(
    alphabet=st.characters(whitelist_categories=('Nd', 'Lu', 'Ll')),
    min_size=10,
    max_size=50
).filter(lambda x: len(x.strip()) >= 10)

email_strategy = st.emails()

avatar_url_strategy = st.from_regex(
    r'https://[a-z]{3,10}\.[a-z]{2,5}/[a-z0-9]{5,20}\.png',
    fullmatch=True
)

user_id_strategy = st.text(
    alphabet=st.characters(whitelist_categories=('Nd', 'Lu', 'Ll', 'Pc')),
    min_size=3,
    max_size=30
).filter(lambda x: len(x.strip()) >= 3)


@pytest.fixture
def db_session():
    """Create a fresh in-memory database for each test"""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


class TestUserRepositoryRoundTrip:
    """
    Property-Based Tests for User Creation/Retrieval Round-Trip
    
    **Feature: google-login, Property 1: User Creation/Retrieval Round-Trip**
    **Validates: Requirements 2.4, 6.1, 6.2, 6.3**
    """

    @given(
        user_id=user_id_strategy,
        google_id=google_id_strategy,
        email=email_strategy,
        avatar_url=avatar_url_strategy
    )
    @settings(max_examples=100, deadline=None)
    def test_user_google_info_round_trip(self, user_id, google_id, email, avatar_url):
        """
        Property 1: User Creation/Retrieval Round-Trip
        
        For any valid Google user info (google_id, email, avatar_url), if we:
        1. Create a user
        2. Update their Google info
        3. Retrieve by google_id
        
        Then the returned user should have the same google_id, email, and avatar_url.
        
        **Validates: Requirements 2.4, 6.1, 6.2, 6.3**
        """
        # Create fresh database for each example
        engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        session = Session()
        
        try:
            repo = UserRepository(session)
            
            # Step 1: Create user (get_user creates if not exists)
            user = repo.get_user(user_id)
            assert user is not None
            assert user.user_id == user_id
            
            # Step 2: Update Google info (Requirements 6.1, 6.3)
            result = repo.update_google_info(user_id, google_id, email, avatar_url)
            assert result is True
            
            # Step 3: Retrieve by google_id (Requirements 6.2)
            retrieved_user = repo.get_by_google_id(google_id)
            
            # Verify round-trip property (Requirements 2.4)
            assert retrieved_user is not None, f"User with google_id={google_id} should be found"
            assert retrieved_user.google_id == google_id, f"google_id mismatch: {retrieved_user.google_id} != {google_id}"
            assert retrieved_user.email == email, f"email mismatch: {retrieved_user.email} != {email}"
            assert retrieved_user.avatar_url == avatar_url, f"avatar_url mismatch: {retrieved_user.avatar_url} != {avatar_url}"
            assert retrieved_user.user_id == user_id, f"user_id mismatch: {retrieved_user.user_id} != {user_id}"
            
        finally:
            session.close()

    @given(google_id=google_id_strategy)
    @settings(max_examples=100, deadline=None)
    def test_get_by_google_id_returns_none_for_nonexistent(self, google_id):
        """
        For any google_id that hasn't been stored, get_by_google_id should return None.
        
        This is an edge case property that ensures the repository correctly handles
        queries for non-existent users.
        """
        engine = create_engine("sqlite:///:memory:", echo=False)
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        session = Session()
        
        try:
            repo = UserRepository(session)
            
            # Query for a google_id that was never stored
            result = repo.get_by_google_id(google_id)
            
            assert result is None, f"Expected None for non-existent google_id={google_id}"
            
        finally:
            session.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
