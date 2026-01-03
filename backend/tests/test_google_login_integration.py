"""
Google Login Integration Tests

Final verification tests for the Google Login feature.
Tests the complete login flow, session persistence, and logout functionality.

**Task 10: 最终验证**
- 10.1 验证完整登录流程 (Requirements 2.1-2.6, 6.1, 6.2)
- 10.2 验证会话持久化 (Requirements 3.1, 3.2)
- 10.3 验证登出功能 (Requirements 3.3, 3.4)
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from application.auth_service import AuthService, InvalidTokenError
from infrastructure.database import Base
from infrastructure.repositories import UserRepository
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def db_session():
    """Create a fresh in-memory database for each test"""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def auth_service(db_session):
    """Create AuthService with mocked Google client ID"""
    user_repo = UserRepository(db_session)
    with patch.object(AuthService, 'GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com'):
        service = AuthService(user_repo)
        yield service


class TestCompleteLoginFlow:
    """
    Task 10.1: 验证完整登录流程
    
    Tests the complete Google login flow including:
    - New user first login (Requirements 2.1-2.6, 6.1)
    - Existing user repeat login (Requirements 6.2)
    """

    def test_new_user_first_login_creates_user(self, auth_service, db_session):
        """
        Test: New user first login creates user record
        
        Requirements: 2.4, 6.1
        - When token verification succeeds, AuthService SHALL create user record
        - When new user logs in, UserRepository SHALL create new user with google_id
        """
        # Mock Google token verification to return valid user info
        mock_google_info = {
            "google_id": "google_123456789",
            "email": "newuser@example.com",
            "name": "New User",
            "picture": "https://example.com/avatar.png",
            "email_verified": True
        }
        
        with patch.object(auth_service, 'verify_google_token', return_value=mock_google_info):
            result = auth_service.login_with_google("valid_token")
        
        # Verify response contains required fields (Req 2.5)
        assert "access_token" in result
        assert "user_id" in result
        assert result["email"] == "newuser@example.com"
        assert result["name"] == "New User"
        assert result["avatar"] == "https://example.com/avatar.png"
        
        # Verify user was created in database (Req 6.1)
        user_repo = UserRepository(db_session)
        user = user_repo.get_by_google_id("google_123456789")
        assert user is not None
        assert user.google_id == "google_123456789"
        assert user.email == "newuser@example.com"

    def test_existing_user_repeat_login_retrieves_user(self, auth_service, db_session):
        """
        Test: Existing user repeat login retrieves existing user record
        
        Requirements: 6.2
        - When existing user logs in, UserRepository SHALL retrieve existing user by google_id
        """
        # First, create an existing user
        user_repo = UserRepository(db_session)
        existing_user = user_repo.get_user("existing_user")
        user_repo.update_google_info(
            "existing_user", 
            "google_existing_123", 
            "existing@example.com", 
            "https://example.com/existing.png"
        )
        
        # Mock Google token verification
        mock_google_info = {
            "google_id": "google_existing_123",
            "email": "existing@example.com",
            "name": "Existing User",
            "picture": "https://example.com/existing.png",
            "email_verified": True
        }
        
        with patch.object(auth_service, 'verify_google_token', return_value=mock_google_info):
            result = auth_service.login_with_google("valid_token")
        
        # Verify same user_id is returned (Req 6.2)
        assert result["user_id"] == "existing_user"
        assert result["email"] == "existing@example.com"

    def test_login_returns_jwt_access_token(self, auth_service):
        """
        Test: Login returns valid JWT access token
        
        Requirements: 2.6
        - When login completes, AuthService SHALL return access_token
        """
        mock_google_info = {
            "google_id": "google_jwt_test",
            "email": "jwt@example.com",
            "name": "JWT User",
            "picture": None,
            "email_verified": True
        }
        
        with patch.object(auth_service, 'verify_google_token', return_value=mock_google_info):
            result = auth_service.login_with_google("valid_token")
        
        # Verify JWT token is returned
        assert "access_token" in result
        assert result["token_type"] == "bearer"
        assert len(result["access_token"]) > 0
        
        # JWT should have 3 parts separated by dots
        token_parts = result["access_token"].split(".")
        assert len(token_parts) == 3


class TestSessionPersistence:
    """
    Task 10.2: 验证会话持久化
    
    Tests session persistence functionality:
    - Session token can be used to identify user (Requirements 3.1, 3.2)
    """

    def test_access_token_contains_user_id(self, auth_service):
        """
        Test: Access token contains user_id for session identification
        
        Requirements: 3.1, 3.2
        - Session token should contain user identification
        """
        from jose import jwt
        
        mock_google_info = {
            "google_id": "google_session_test",
            "email": "session@example.com",
            "name": "Session User",
            "picture": None,
            "email_verified": True
        }
        
        with patch.object(auth_service, 'verify_google_token', return_value=mock_google_info):
            result = auth_service.login_with_google("valid_token")
        
        # Decode token and verify it contains user_id
        decoded = jwt.decode(
            result["access_token"], 
            auth_service.SECRET_KEY, 
            algorithms=[auth_service.ALGORITHM]
        )
        
        assert "sub" in decoded  # 'sub' is the standard JWT claim for subject (user_id)
        assert decoded["sub"] == result["user_id"]
        assert decoded["login_type"] == "google"

    def test_user_data_persists_across_logins(self, auth_service, db_session):
        """
        Test: User data persists across multiple logins
        
        Requirements: 3.2
        - User data should be retrievable after login
        """
        mock_google_info = {
            "google_id": "google_persist_test",
            "email": "persist@example.com",
            "name": "Persist User",
            "picture": "https://example.com/persist.png",
            "email_verified": True
        }
        
        # First login
        with patch.object(auth_service, 'verify_google_token', return_value=mock_google_info):
            first_result = auth_service.login_with_google("valid_token")
        
        # Second login (simulating session persistence check)
        with patch.object(auth_service, 'verify_google_token', return_value=mock_google_info):
            second_result = auth_service.login_with_google("valid_token")
        
        # Verify same user is returned
        assert first_result["user_id"] == second_result["user_id"]
        
        # Verify user data is consistent
        user_repo = UserRepository(db_session)
        user = user_repo.get_by_google_id("google_persist_test")
        assert user is not None
        assert user.email == "persist@example.com"
        assert user.avatar_url == "https://example.com/persist.png"


class TestLogoutFunctionality:
    """
    Task 10.3: 验证登出功能
    
    Tests logout functionality:
    - User data remains in database after logout (Requirements 3.3, 3.4)
    - User can re-login after logout
    """

    def test_user_data_remains_after_logout(self, auth_service, db_session):
        """
        Test: User data remains in database (logout only clears client session)
        
        Requirements: 3.3
        - Logout clears session but user data persists in database
        """
        mock_google_info = {
            "google_id": "google_logout_test",
            "email": "logout@example.com",
            "name": "Logout User",
            "picture": "https://example.com/logout.png",
            "email_verified": True
        }
        
        # Login first
        with patch.object(auth_service, 'verify_google_token', return_value=mock_google_info):
            result = auth_service.login_with_google("valid_token")
        
        user_id = result["user_id"]
        
        # Simulate logout (client-side clears token)
        # Backend doesn't have explicit logout - it's handled by client clearing storage
        
        # Verify user still exists in database
        user_repo = UserRepository(db_session)
        user = user_repo.get_by_google_id("google_logout_test")
        assert user is not None
        assert user.user_id == user_id

    def test_user_can_relogin_after_logout(self, auth_service, db_session):
        """
        Test: User can re-login after logout
        
        Requirements: 3.3, 3.4
        - After logout, user can login again and get same user_id
        """
        mock_google_info = {
            "google_id": "google_relogin_test",
            "email": "relogin@example.com",
            "name": "Relogin User",
            "picture": None,
            "email_verified": True
        }
        
        # First login
        with patch.object(auth_service, 'verify_google_token', return_value=mock_google_info):
            first_result = auth_service.login_with_google("valid_token")
        
        first_user_id = first_result["user_id"]
        
        # Simulate logout (client clears session)
        # ...
        
        # Re-login
        with patch.object(auth_service, 'verify_google_token', return_value=mock_google_info):
            second_result = auth_service.login_with_google("valid_token")
        
        # Verify same user_id is returned
        assert second_result["user_id"] == first_user_id


class TestErrorHandling:
    """
    Additional error handling tests for login flow
    """

    def test_invalid_token_returns_error(self, auth_service):
        """
        Test: Invalid token returns appropriate error
        
        Requirements: 4.2, 4.4
        """
        with pytest.raises(InvalidTokenError):
            auth_service.verify_google_token("invalid_short")

    def test_empty_token_returns_error(self, auth_service):
        """
        Test: Empty token returns appropriate error
        
        Requirements: 4.2
        """
        with pytest.raises(InvalidTokenError):
            auth_service.verify_google_token("")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
