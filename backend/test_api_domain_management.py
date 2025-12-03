"""
API Endpoint Tests for Domain Management

Tests complete HTTP flows through FastAPI
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from fastapi.testclient import TestClient
    from infrastructure.database import Base, get_db
    from infrastructure.models import UserModel
    from main import app
except ImportError:
    # If FastAPI/TestClient not available, skip API tests
    pytestmark = pytest.mark.skip(reason="FastAPI not available for API tests")


@pytest.fixture
def test_db():
    """Create in-memory SQLite database for testing"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    return SessionLocal()


@pytest.fixture
def client(test_db):
    """Create test client"""
    return TestClient(app)


@pytest.fixture
def test_user_id():
    """Test user ID"""
    return "api_test_user"


class TestBlacklistEndpoints:
    """Test blacklist API endpoints"""

    def test_get_empty_blacklist(self, client, test_user_id):
        """GET /users/{id}/domain-policies/blacklist"""
        response = client.get(f"/users/{test_user_id}/domain-policies/blacklist")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["count"] == 0
        assert data["blacklist_domains"] == []

    def test_add_blacklist_domain(self, client, test_user_id):
        """POST /users/{id}/domain-policies/blacklist"""
        response = client.post(
            f"/users/{test_user_id}/domain-policies/blacklist",
            json={"domain": "example.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["domain"] == "example.com"

    def test_get_blacklist_after_add(self, client, test_user_id):
        """GET blacklist after adding domain"""
        # Add domain
        client.post(
            f"/users/{test_user_id}/domain-policies/blacklist",
            json={"domain": "github.com"}
        )

        # Get blacklist
        response = client.get(f"/users/{test_user_id}/domain-policies/blacklist")
        data = response.json()
        assert data["success"] is True
        assert "github.com" in data["blacklist_domains"]

    def test_get_detailed_blacklist(self, client, test_user_id):
        """GET /users/{id}/domain-policies/blacklist/detailed"""
        # Add domain with description
        client.post(
            f"/users/{test_user_id}/domain-policies/blacklist",
            json={"domain": "test.com", "description": "Test website"}
        )

        # Get detailed
        response = client.get(f"/users/{test_user_id}/domain-policies/blacklist/detailed")
        data = response.json()
        assert data["success"] is True
        assert len(data["policies"]) == 1
        assert data["policies"][0]["domain"] == "test.com"
        assert data["policies"][0]["description"] == "Test website"

    def test_remove_blacklist_domain(self, client, test_user_id):
        """DELETE /users/{id}/domain-policies/blacklist/{domain}"""
        # Add domain
        client.post(
            f"/users/{test_user_id}/domain-policies/blacklist",
            json={"domain": "remove-me.com"}
        )

        # Remove domain
        response = client.delete(
            f"/users/{test_user_id}/domain-policies/blacklist/remove-me.com"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify it's gone
        response = client.get(f"/users/{test_user_id}/domain-policies/blacklist")
        data = response.json()
        assert "remove-me.com" not in data["blacklist_domains"]

    def test_batch_add_blacklist(self, client, test_user_id):
        """POST /users/{id}/domain-policies/blacklist/batch"""
        domains = ["a.com", "b.com", "c.com"]
        response = client.post(
            f"/users/{test_user_id}/domain-policies/blacklist/batch",
            json={"domains": domains}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["count"] == 3

    def test_batch_remove_blacklist(self, client, test_user_id):
        """POST /users/{id}/domain-policies/blacklist/batch-remove"""
        # Add domains
        client.post(
            f"/users/{test_user_id}/domain-policies/blacklist/batch",
            json={"domains": ["x.com", "y.com", "z.com"]}
        )

        # Remove some
        response = client.post(
            f"/users/{test_user_id}/domain-policies/blacklist/batch-remove",
            json={"domains": ["x.com", "z.com"]}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["count"] == 2


class TestWhitelistEndpoints:
    """Test whitelist API endpoints (Phase 2 ready)"""

    def test_get_empty_whitelist(self, client, test_user_id):
        """GET /users/{id}/domain-policies/whitelist"""
        response = client.get(f"/users/{test_user_id}/domain-policies/whitelist")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["count"] == 0

    def test_add_whitelist_domain(self, client, test_user_id):
        """POST /users/{id}/domain-policies/whitelist"""
        response = client.post(
            f"/users/{test_user_id}/domain-policies/whitelist",
            json={"domain": "allowed.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True


class TestUtilityEndpoints:
    """Test utility endpoints"""

    def test_check_domain_excluded(self, client, test_user_id):
        """POST /users/{id}/domain-policies/check"""
        # Add domain to blacklist
        client.post(
            f"/users/{test_user_id}/domain-policies/blacklist",
            json={"domain": "blocked.com"}
        )

        # Check if excluded
        response = client.post(
            f"/users/{test_user_id}/domain-policies/check",
            json={"domain": "blocked.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["should_exclude"] is True

    def test_check_domain_not_excluded(self, client, test_user_id):
        """Check domain not in blacklist"""
        response = client.post(
            f"/users/{test_user_id}/domain-policies/check",
            json={"domain": "safe.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["should_exclude"] is False

    def test_get_statistics(self, client, test_user_id):
        """GET /users/{id}/domain-policies/statistics"""
        # Add some domains
        client.post(
            f"/users/{test_user_id}/domain-policies/blacklist/batch",
            json={"domains": ["a.com", "b.com", "c.com"]}
        )

        response = client.get(f"/users/{test_user_id}/domain-policies/statistics")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["blacklist_count"] == 3
        assert data["whitelist_count"] == 0
        assert data["total_policies"] == 3


class TestAPIErrorHandling:
    """Test error handling in API"""

    def test_invalid_domain_format(self, client, test_user_id):
        """Invalid domain should be handled"""
        response = client.post(
            f"/users/{test_user_id}/domain-policies/blacklist",
            json={"domain": ""}
        )
        # May return 200 or 400 depending on validation
        assert response.status_code in [200, 400, 422]

    def test_missing_domain_field(self, client, test_user_id):
        """Missing domain field should be handled"""
        response = client.post(
            f"/users/{test_user_id}/domain-policies/blacklist",
            json={}
        )
        assert response.status_code in [400, 422]

    def test_special_characters_in_domain(self, client, test_user_id):
        """Domain with special chars should be handled"""
        response = client.post(
            f"/users/{test_user_id}/domain-policies/blacklist",
            json={"domain": "test@domain.com"}
        )
        # Should either accept or reject gracefully
        assert response.status_code in [200, 400, 422]


class TestAPIConcurrency:
    """Test API behavior under multiple requests"""

    def test_multiple_users_concurrent(self, client):
        """Multiple users should have isolated data"""
        users = ["user1", "user2", "user3"]
        domains = ["a.com", "b.com", "c.com"]

        # Each user adds all domains
        for user in users:
            response = client.post(
                f"/users/{user}/domain-policies/blacklist/batch",
                json={"domains": domains}
            )
            assert response.status_code == 200

        # Verify each user has their own data
        for user in users:
            response = client.get(f"/users/{user}/domain-policies/blacklist")
            data = response.json()
            assert data["count"] == 3
            assert set(data["blacklist_domains"]) == set(domains)

    def test_idempotent_add(self, client, test_user_id):
        """Adding same domain multiple times should be safe"""
        domain = "idempotent.com"

        for _ in range(3):
            response = client.post(
                f"/users/{test_user_id}/domain-policies/blacklist",
                json={"domain": domain}
            )
            assert response.status_code == 200
            assert response.json()["success"] is True

        # Should only have one
        response = client.get(f"/users/{test_user_id}/domain-policies/blacklist")
        data = response.json()
        assert data["count"] == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
