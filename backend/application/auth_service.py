import os
from typing import Dict, Optional
from uuid import uuid4

from domain.models import User
from google.auth.transport import requests
from google.oauth2 import id_token
from infrastructure.repositories import UserRepository
from jose import jwt


class AuthConfigurationError(Exception):
    """Raised when AuthService configuration is invalid or missing."""
    pass


class InvalidTokenError(Exception):
    """
    Raised when a Google token is invalid, malformed, or cannot be verified.
    (Requirements 4.2, 4.4)
    """
    def __init__(self, message: str, reason: str = "unknown"):
        self.message = message
        self.reason = reason
        super().__init__(self.message)


class TokenExpiredError(InvalidTokenError):
    """Raised when a Google token has expired. (Requirement 4.4)"""
    def __init__(self, message: str = "Token has expired"):
        super().__init__(message, reason="expired")


class AuthService:
    """
    Authentication Service
    Handles Google Login and Session Management
    """
    
    # Placeholder for Client ID - to be provided via environment variable
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_SECRET_KEY_PLACEHOLDER")
    ALGORITHM = "HS256"

    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository
        self._validate_config()

    def _validate_config(self) -> None:
        """
        Validate required configuration.
        Raises AuthConfigurationError if GOOGLE_CLIENT_ID is not configured.
        (Requirements 1.2, 1.3)
        """
        if not self.GOOGLE_CLIENT_ID or self.GOOGLE_CLIENT_ID == "YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER":
            raise AuthConfigurationError(
                "GOOGLE_CLIENT_ID environment variable is not configured. "
                "Please set GOOGLE_CLIENT_ID to your Google OAuth client ID."
            )

    def verify_google_token(self, token: str) -> Dict:
        """
        Verify Google Token (access_token or ID token)
        Returns user info if valid
        
        For access_token: calls Google userinfo endpoint
        For ID token: verifies with Google's public keys
        
        Raises:
            InvalidTokenError: When token is invalid, malformed, or verification fails
            TokenExpiredError: When token has expired
        
        (Requirements 4.2, 4.4)
        """
        # Validate token format first
        if not token or not isinstance(token, str):
            raise InvalidTokenError(
                "Invalid token format: Token must be a non-empty string",
                reason="invalid_format"
            )
        
        # Check for obviously malformed tokens
        token = token.strip()
        if len(token) < 10:
            raise InvalidTokenError(
                "Invalid token format: Token is too short to be valid",
                reason="invalid_format"
            )
        
        # Try to use token as access_token first (for launchWebAuthFlow)
        try:
            import httpx
            
            # Call Google userinfo endpoint with access_token
            response = httpx.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                user_info = response.json()
                return {
                    "google_id": user_info.get("sub"),
                    "email": user_info.get("email"),
                    "name": user_info.get("name"),
                    "picture": user_info.get("picture"),
                    "email_verified": user_info.get("email_verified", False)
                }
            elif response.status_code == 401:
                # Token might be an ID token, try that approach
                pass
            else:
                raise InvalidTokenError(
                    f"Google API error: {response.status_code}",
                    reason="api_error"
                )
        except httpx.RequestError as e:
            # Network error, try ID token verification as fallback
            pass
        except Exception as e:
            if "InvalidTokenError" in str(type(e)):
                raise
            # Continue to try ID token verification
            pass
        
        # Fallback: Try to verify as ID token
        try:
            id_info = id_token.verify_oauth2_token(
                token, 
                requests.Request(), 
                self.GOOGLE_CLIENT_ID
            )

            return {
                "google_id": id_info["sub"],
                "email": id_info.get("email"),
                "name": id_info.get("name"),
                "picture": id_info.get("picture"),
                "email_verified": id_info.get("email_verified")
            }
        except ValueError as e:
            error_str = str(e).lower()
            
            if "expired" in error_str:
                raise TokenExpiredError(f"Token has expired: {str(e)}")
            elif "invalid" in error_str or "malformed" in error_str:
                raise InvalidTokenError(
                    f"Invalid Google Token: {str(e)}",
                    reason="verification_failed"
                )
            else:
                raise InvalidTokenError(
                    f"Token verification failed: {str(e)}",
                    reason="verification_failed"
                )
        except Exception as e:
            raise InvalidTokenError(
                f"Unexpected error during token verification: {str(e)}",
                reason="unexpected_error"
            )

    def login_with_google(self, token: str) -> Dict:
        """
        Login or Register with Google Token
        """
        # 1. Verify Token
        google_info = self.verify_google_token(token)
        google_id = google_info["google_id"]
        email = google_info["email"]

        # 2. Check if user exists
        user = self.user_repository.get_by_google_id(google_id)

        if not user:
            # 2.1 Register new user if not exists
            # Use email prefix or UUID as internal user_id
            internal_user_id = email.split("@")[0] if email else str(uuid4())
            
            # Ensure uniqueness (simple check)
            if self.user_repository.get_user(internal_user_id).created_at:
                internal_user_id = f"{internal_user_id}_{str(uuid4())[:8]}"

            user = self.user_repository.get_user(internal_user_id) # Creates user
            
            # Update Google fields implementation (Need to update save_user to handle generic updates or handle explicit update here)
            # Since domain model might not have google_id, we might need to access ORM directly or update domain model
            # For now, let's assume we update the ORM model via repository for these specific fields
            
            # TODO: Add google_id/email to domain model or handle via specialized repository method
            # For MVP, we'll patch it in the repo call below (custom method)
            self.user_repository.update_google_info(user.user_id, google_id, email, google_info.get("picture"))

        # 3. Create Session Token (JWT)
        access_token = self.create_access_token(
            data={"sub": user.user_id, "login_type": "google"}
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user_id": user.user_id,
            "email": email,
            "name": google_info.get("name"),
            "avatar": google_info.get("picture")
        }

    def create_access_token(self, data: dict):
        return jwt.encode(data, self.SECRET_KEY, algorithm=self.ALGORITHM)
