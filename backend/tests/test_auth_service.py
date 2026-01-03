"""
AuthService Unit Tests
测试 AuthService 的配置验证和核心功能
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from application.auth_service import (
    AuthConfigurationError,
    AuthService,
    InvalidTokenError,
    TokenExpiredError,
)


class TestAuthServiceConfiguration:
    """测试 AuthService 配置验证 (Requirements 1.2, 1.3)"""

    def test_missing_google_client_id_raises_error(self):
        """当 GOOGLE_CLIENT_ID 未配置时应抛出 AuthConfigurationError"""
        mock_repo = MagicMock()
        
        # Patch the class attribute to simulate missing config
        with patch.object(AuthService, 'GOOGLE_CLIENT_ID', ''):
            with pytest.raises(AuthConfigurationError) as exc_info:
                AuthService(mock_repo)
            
            assert "GOOGLE_CLIENT_ID" in str(exc_info.value)
            assert "not configured" in str(exc_info.value)

    def test_placeholder_google_client_id_raises_error(self):
        """当 GOOGLE_CLIENT_ID 是占位符时应抛出 AuthConfigurationError"""
        mock_repo = MagicMock()
        
        with patch.object(AuthService, 'GOOGLE_CLIENT_ID', 'YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER'):
            with pytest.raises(AuthConfigurationError) as exc_info:
                AuthService(mock_repo)
            
            assert "GOOGLE_CLIENT_ID" in str(exc_info.value)

    def test_valid_google_client_id_initializes_successfully(self):
        """当 GOOGLE_CLIENT_ID 配置正确时应正常初始化"""
        mock_repo = MagicMock()
        
        with patch.object(AuthService, 'GOOGLE_CLIENT_ID', 'valid-client-id.apps.googleusercontent.com'):
            # Should not raise any exception
            service = AuthService(mock_repo)
            assert service.user_repository == mock_repo

    def test_error_message_is_descriptive(self):
        """错误消息应该清晰描述问题和解决方案"""
        mock_repo = MagicMock()
        
        with patch.object(AuthService, 'GOOGLE_CLIENT_ID', ''):
            with pytest.raises(AuthConfigurationError) as exc_info:
                AuthService(mock_repo)
            
            error_message = str(exc_info.value)
            # Should mention the environment variable name
            assert "GOOGLE_CLIENT_ID" in error_message
            # Should indicate it's an environment variable
            assert "environment variable" in error_message


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])


class TestInvalidTokenRejection:
    """
    Property-Based Tests for Invalid Token Rejection
    
    **Property 2: Invalid Token Rejection**
    *For any* invalid or malformed token string, the Auth_Service should 
    return an InvalidTokenError with a descriptive message.
    
    **Validates: Requirements 4.2, 4.4**
    """

    def _create_auth_service(self):
        """Create an AuthService instance with mocked repository and valid config."""
        mock_repo = MagicMock()
        with patch.object(AuthService, 'GOOGLE_CLIENT_ID', 'valid-client-id.apps.googleusercontent.com'):
            return AuthService(mock_repo)

    @given(st.text(min_size=0, max_size=9))
    @settings(max_examples=100)
    def test_short_tokens_are_rejected(self, token):
        """
        **Feature: google-login, Property 2: Invalid Token Rejection**
        
        *For any* token string shorter than 10 characters, the Auth_Service 
        should raise InvalidTokenError.
        
        **Validates: Requirements 4.2, 4.4**
        """
        auth_service = self._create_auth_service()
        with pytest.raises(InvalidTokenError) as exc_info:
            auth_service.verify_google_token(token)
        
        # Verify error message is descriptive
        assert exc_info.value.message is not None
        assert len(exc_info.value.message) > 0

    @given(st.sampled_from([None, "", "   ", "\t\n", "  \r\n  "]))
    @settings(max_examples=100)
    def test_empty_or_whitespace_tokens_are_rejected(self, token):
        """
        **Feature: google-login, Property 2: Invalid Token Rejection**
        
        *For any* empty or whitespace-only token, the Auth_Service 
        should raise InvalidTokenError.
        
        **Validates: Requirements 4.2, 4.4**
        """
        auth_service = self._create_auth_service()
        with pytest.raises(InvalidTokenError) as exc_info:
            auth_service.verify_google_token(token)
        
        # Verify error has descriptive message
        assert "invalid" in exc_info.value.message.lower() or "format" in exc_info.value.message.lower()

    @given(st.text(min_size=10, max_size=500).filter(lambda x: x.strip()))
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_random_strings_are_rejected_as_invalid_tokens(self, token):
        """
        **Feature: google-login, Property 2: Invalid Token Rejection**
        
        *For any* random string that is not a valid Google ID token, 
        the Auth_Service should raise InvalidTokenError.
        
        **Validates: Requirements 4.2, 4.4**
        """
        auth_service = self._create_auth_service()
        
        # Mock the Google verification to simulate invalid token error
        with patch('application.auth_service.id_token.verify_oauth2_token') as mock_verify:
            mock_verify.side_effect = ValueError("Invalid token")
            
            with pytest.raises(InvalidTokenError) as exc_info:
                auth_service.verify_google_token(token)
            
            # Verify error is descriptive
            error = exc_info.value
            assert error.message is not None
            assert error.reason is not None

    @given(st.binary(min_size=10, max_size=200).map(lambda b: b.decode('utf-8', errors='replace')))
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_binary_garbage_tokens_are_rejected(self, token):
        """
        **Feature: google-login, Property 2: Invalid Token Rejection**
        
        *For any* binary garbage converted to string, the Auth_Service 
        should raise InvalidTokenError.
        
        **Validates: Requirements 4.2, 4.4**
        """
        # Skip if token becomes too short after strip
        if len(token.strip()) < 10:
            return
        
        auth_service = self._create_auth_service()
        
        # Mock the Google verification to simulate invalid token error
        with patch('application.auth_service.id_token.verify_oauth2_token') as mock_verify:
            mock_verify.side_effect = ValueError("Invalid token")
            
            with pytest.raises(InvalidTokenError) as exc_info:
                auth_service.verify_google_token(token)
            
            # Verify error is descriptive
            assert exc_info.value.message is not None

    @given(st.text(min_size=10, max_size=100, alphabet=st.characters(whitelist_categories=('L', 'N', 'P'))))
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_malformed_jwt_like_tokens_are_rejected(self, token):
        """
        **Feature: google-login, Property 2: Invalid Token Rejection**
        
        *For any* string that looks like it could be a JWT but isn't valid,
        the Auth_Service should raise InvalidTokenError.
        
        **Validates: Requirements 4.2, 4.4**
        """
        # Create a fake JWT-like structure
        fake_jwt = f"{token}.{token}.{token}"
        
        auth_service = self._create_auth_service()
        
        # Mock the Google verification to simulate invalid token error
        with patch('application.auth_service.id_token.verify_oauth2_token') as mock_verify:
            mock_verify.side_effect = ValueError("Invalid token")
            
            with pytest.raises(InvalidTokenError) as exc_info:
                auth_service.verify_google_token(fake_jwt)
            
            # Verify error is descriptive
            assert exc_info.value.message is not None
            assert exc_info.value.reason is not None

    @given(st.text(min_size=15, max_size=100).filter(lambda x: len(x.strip()) >= 10))
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.too_slow])
    def test_expired_tokens_raise_token_expired_error(self, token):
        """
        **Feature: google-login, Property 2: Invalid Token Rejection**
        
        *For any* token that Google reports as expired, the Auth_Service 
        should raise TokenExpiredError.
        
        **Validates: Requirements 4.4**
        """
        auth_service = self._create_auth_service()
        
        # Mock the Google verification to simulate expired token error
        with patch('application.auth_service.id_token.verify_oauth2_token') as mock_verify:
            mock_verify.side_effect = ValueError("Token expired")
            
            with pytest.raises(TokenExpiredError) as exc_info:
                auth_service.verify_google_token(token)
            
            # Verify error is descriptive
            assert exc_info.value.message is not None
            assert "expired" in exc_info.value.message.lower()
