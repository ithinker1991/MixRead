import os
from typing import Dict, Optional
from uuid import uuid4

from domain.models import User
from google.auth.transport import requests
from google.oauth2 import id_token
from infrastructure.repositories import UserRepository
from jose import jwt


class AuthService:
    """
    Authentication Service
    Handles Google Login and Session Management
    """
    
    # Placeholder for Client ID - to be provided via environment variable
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER")
    SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_SECRET_KEY_PLACEHOLDER")
    ALGORITHM = "HS256"

    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    def verify_google_token(self, token: str) -> Dict:
        """
        Verify Google ID Token
        Returns user info if valid
        """
        try:
            # Specify the CLIENT_ID of the app that accesses the backend:
            id_info = id_token.verify_oauth2_token(
                token, 
                requests.Request(), 
                self.GOOGLE_CLIENT_ID if self.GOOGLE_CLIENT_ID != "YOUR_GOOGLE_CLIENT_ID_PLACEHOLDER" else None
            )

            # ID token is valid. Get the user's Google Account ID from the decoded token.
            return {
                "google_id": id_info["sub"],
                "email": id_info.get("email"),
                "name": id_info.get("name"),
                "picture": id_info.get("picture"),
                "email_verified": id_info.get("email_verified")
            }
        except ValueError as e:
            # Invalid token
            raise Exception(f"Invalid Google Token: {str(e)}")

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
