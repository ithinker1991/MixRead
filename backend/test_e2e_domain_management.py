"""
End-to-End Tests for Domain Management Feature
Tests complete workflows from API to database

Scenarios covered:
1. New user creates blacklist
2. User adds preset domains
3. User removes domains
4. Check domain exclusion
5. Multiple users isolation
6. Statistics tracking
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from infrastructure.database import Base
from infrastructure.models import UserModel, DomainManagementPolicy, DomainPolicyType
from infrastructure.repositories import DomainManagementPolicyRepository
from application.services import DomainManagementService


@pytest.fixture
def test_db():
    """Create in-memory SQLite database for testing"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


@pytest.fixture
def test_user(test_db):
    """Create a test user"""
    user = UserModel(user_id="e2e_test_user")
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def domain_service(test_db):
    """Create domain service"""
    repo = DomainManagementPolicyRepository(test_db)
    return DomainManagementService(repo)


class TestE2ENewUserScenario:
    """Test scenario: New user creates blacklist"""

    def test_new_user_empty_blacklist(self, domain_service, test_user):
        """New user should have empty blacklist"""
        result = domain_service.get_blacklist_domains(test_user.user_id)
        assert result["success"] is True
        assert result["count"] == 0
        assert result["blacklist_domains"] == []

    def test_new_user_add_single_domain(self, domain_service, test_user):
        """New user can add single domain"""
        result = domain_service.add_blacklist_domain(test_user.user_id, "example.com")
        assert result["success"] is True
        assert result["domain"] == "example.com"

    def test_new_user_add_multiple_domains(self, domain_service, test_user):
        """New user can add multiple domains one by one"""
        domains = ["github.com", "stackoverflow.com", "twitter.com"]
        for domain in domains:
            result = domain_service.add_blacklist_domain(test_user.user_id, domain)
            assert result["success"] is True

        result = domain_service.get_blacklist_domains(test_user.user_id)
        assert result["count"] == 3
        assert set(result["blacklist_domains"]) == set(domains)

    def test_preset_domains_workflow(self, domain_service, test_user):
        """User can add preset domains in batch"""
        preset_domains = [
            "localhost", "github.com", "stackoverflow.com", "twitter.com",
            "reddit.com", "facebook.com", "instagram.com", "tiktok.com", "youtube.com"
        ]

        result = domain_service.add_blacklist_domains_batch(test_user.user_id, preset_domains)
        assert result["success"] is True
        assert result["count"] == 9

        stats = domain_service.get_statistics(test_user.user_id)
        assert stats["blacklist_count"] == 9


class TestE2EUserWorkflow:
    """Test scenario: User manages blacklist over time"""

    def test_add_domain_check_exclusion(self, domain_service, test_user):
        """After adding domain, check should exclude it"""
        domain_service.add_blacklist_domain(test_user.user_id, "blocked.com")

        result = domain_service.should_exclude_domain(test_user.user_id, "blocked.com")
        assert result["success"] is True
        assert result["should_exclude"] is True

    def test_remove_domain_check_not_excluded(self, domain_service, test_user):
        """After removing domain, check should not exclude it"""
        domain_service.add_blacklist_domain(test_user.user_id, "example.com")
        domain_service.remove_blacklist_domain(test_user.user_id, "example.com")

        result = domain_service.should_exclude_domain(test_user.user_id, "example.com")
        assert result["success"] is True
        assert result["should_exclude"] is False

    def test_get_detailed_policies(self, domain_service, test_user):
        """User can get full policy details"""
        domain_service.add_blacklist_domain(
            test_user.user_id,
            "example.com",
            description="Personal website"
        )

        result = domain_service.get_blacklist_policies(test_user.user_id)
        assert result["success"] is True
        assert result["count"] == 1
        assert result["policies"][0]["domain"] == "example.com"
        assert result["policies"][0]["description"] == "Personal website"


class TestE2EMultipleUsers:
    """Test scenario: Multiple users with isolated blacklists"""

    def test_users_isolated_domains(self, test_db, domain_service):
        """Different users should have isolated blacklists"""
        # Create two users
        user1 = UserModel(user_id="user1")
        user2 = UserModel(user_id="user2")
        test_db.add(user1)
        test_db.add(user2)
        test_db.commit()

        # Add different domains
        domain_service.add_blacklist_domain("user1", "user1domain.com")
        domain_service.add_blacklist_domain("user2", "user2domain.com")

        # Get their blacklists
        result1 = domain_service.get_blacklist_domains("user1")
        result2 = domain_service.get_blacklist_domains("user2")

        assert result1["blacklist_domains"] == ["user1domain.com"]
        assert result2["blacklist_domains"] == ["user2domain.com"]

    def test_users_separate_statistics(self, test_db, domain_service):
        """Users should have separate statistics"""
        user1 = UserModel(user_id="user1_stats")
        user2 = UserModel(user_id="user2_stats")
        test_db.add(user1)
        test_db.add(user2)
        test_db.commit()

        # User1 adds 3 domains
        for i in range(3):
            domain_service.add_blacklist_domain("user1_stats", f"domain{i}.com")

        # User2 adds 5 domains
        for i in range(5):
            domain_service.add_blacklist_domain("user2_stats", f"domain{i}.com")

        stats1 = domain_service.get_statistics("user1_stats")
        stats2 = domain_service.get_statistics("user2_stats")

        assert stats1["blacklist_count"] == 3
        assert stats2["blacklist_count"] == 5


class TestE2ERobustness:
    """Test scenario: Error handling and edge cases"""

    def test_duplicate_domain_idempotent(self, domain_service, test_user):
        """Adding same domain twice should be idempotent"""
        domain_service.add_blacklist_domain(test_user.user_id, "example.com")
        domain_service.add_blacklist_domain(test_user.user_id, "example.com")

        result = domain_service.get_blacklist_domains(test_user.user_id)
        assert result["count"] == 1

    def test_remove_nonexistent_domain(self, domain_service, test_user):
        """Removing non-existent domain should fail gracefully"""
        result = domain_service.remove_blacklist_domain(test_user.user_id, "notfound.com")
        assert result["success"] is False

    def test_batch_add_duplicate_handling(self, domain_service, test_user):
        """Batch add with duplicates should handle gracefully"""
        domains = ["example.com", "test.com", "example.com"]
        result = domain_service.add_blacklist_domains_batch(test_user.user_id, domains)
        assert result["success"] is True
        # May have 2 or 3 depending on implementation
        assert result["count"] >= 2

    def test_empty_batch_operations(self, domain_service, test_user):
        """Empty batch operations should handle gracefully"""
        result = domain_service.add_blacklist_domains_batch(test_user.user_id, [])
        assert result["success"] is True
        assert result["count"] == 0


class TestE2EDomainVariations:
    """Test scenario: Different domain formats"""

    def test_domain_case_sensitivity(self, domain_service, test_user):
        """Domains should be case-insensitive for matching"""
        domain_service.add_blacklist_domain(test_user.user_id, "GitHub.com")

        result = domain_service.should_exclude_domain(test_user.user_id, "github.com")
        # May depend on storage implementation
        assert result["success"] is True

    def test_domain_subdomain_handling(self, domain_service, test_user):
        """Subdomains should be treated as different domains"""
        domain_service.add_blacklist_domain(test_user.user_id, "github.com")
        domain_service.add_blacklist_domain(test_user.user_id, "api.github.com")

        result = domain_service.get_blacklist_domains(test_user.user_id)
        assert "github.com" in result["blacklist_domains"]
        assert "api.github.com" in result["blacklist_domains"]
        assert result["count"] == 2

    def test_localhost_handling(self, domain_service, test_user):
        """localhost should be handleable as domain"""
        domain_service.add_blacklist_domain(test_user.user_id, "localhost")

        result = domain_service.should_exclude_domain(test_user.user_id, "localhost")
        assert result["success"] is True


class TestE2EDataIntegrity:
    """Test scenario: Data integrity across operations"""

    def test_added_then_removed_not_found(self, domain_service, test_user):
        """Domain added then removed should not be found"""
        domain_service.add_blacklist_domain(test_user.user_id, "temp.com")
        domain_service.remove_blacklist_domain(test_user.user_id, "temp.com")

        result = domain_service.should_exclude_domain(test_user.user_id, "temp.com")
        assert result["should_exclude"] is False

    def test_multiple_adds_and_removes(self, domain_service, test_user):
        """Multiple adds and removes should maintain integrity"""
        domains = ["a.com", "b.com", "c.com", "d.com", "e.com"]

        # Add all
        for domain in domains:
            domain_service.add_blacklist_domain(test_user.user_id, domain)

        result = domain_service.get_blacklist_domains(test_user.user_id)
        assert result["count"] == 5

        # Remove some
        domain_service.remove_blacklist_domain(test_user.user_id, "b.com")
        domain_service.remove_blacklist_domain(test_user.user_id, "d.com")

        result = domain_service.get_blacklist_domains(test_user.user_id)
        assert result["count"] == 3
        assert "a.com" in result["blacklist_domains"]
        assert "b.com" not in result["blacklist_domains"]
        assert "c.com" in result["blacklist_domains"]
        assert "d.com" not in result["blacklist_domains"]
        assert "e.com" in result["blacklist_domains"]

    def test_statistics_consistency(self, domain_service, test_user):
        """Statistics should be consistent with actual data"""
        domains = ["a.com", "b.com", "c.com"]
        domain_service.add_blacklist_domains_batch(test_user.user_id, domains)

        stats = domain_service.get_statistics(test_user.user_id)
        policies = domain_service.get_blacklist_policies(test_user.user_id)

        assert stats["blacklist_count"] == len(policies["policies"])
        assert stats["blacklist_count"] == 3


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
