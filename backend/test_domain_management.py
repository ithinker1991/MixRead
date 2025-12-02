"""
Unit tests for Domain Management Policy feature

Tests cover:
- Repository operations (CRUD)
- Service business logic
- API endpoints
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from infrastructure.database import Base
from infrastructure.models import UserModel, DomainManagementPolicy, DomainPolicyType
from infrastructure.repositories import DomainManagementPolicyRepository
from application.services import DomainManagementService


# ========== Test Fixtures ==========

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
    user = UserModel(user_id="test_user_1")
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def domain_repo(test_db):
    """Create domain repository"""
    return DomainManagementPolicyRepository(test_db)


@pytest.fixture
def domain_service(domain_repo):
    """Create domain service"""
    return DomainManagementService(domain_repo)


# ========== Repository Tests ==========

class TestDomainRepositoryBasics:
    """Test basic CRUD operations"""

    def test_add_domain_to_blacklist(self, domain_repo, test_user):
        """Test adding a domain to blacklist"""
        policy = domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )

        assert policy is not None
        assert policy.user_id == test_user.user_id
        assert policy.domain == "example.com"
        assert policy.policy_type == DomainPolicyType.BLACKLIST
        assert policy.is_active is True

    def test_add_duplicate_domain(self, domain_repo, test_user):
        """Test adding duplicate domain returns existing"""
        domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )

        # Add same domain again
        policy = domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )

        assert policy is not None
        assert policy.is_active is True

    def test_reactivate_disabled_domain(self, domain_repo, test_user):
        """Test reactivating a disabled domain"""
        # Add and remove
        domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )
        domain_repo.remove_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )

        # Re-add the domain
        policy = domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )

        assert policy.is_active is True

    def test_remove_domain(self, domain_repo, test_user):
        """Test removing (soft delete) a domain"""
        domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )

        result = domain_repo.remove_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )

        assert result is True

        # Should not be in active list
        domains = domain_repo.get_by_user_and_type(
            user_id=test_user.user_id,
            policy_type=DomainPolicyType.BLACKLIST
        )
        assert "example.com" not in domains

    def test_hard_delete_domain(self, domain_repo, test_user):
        """Test hard delete of a domain"""
        domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )

        result = domain_repo.hard_delete_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )

        assert result is True

    def test_domain_exists(self, domain_repo, test_user):
        """Test checking if domain exists"""
        domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )

        exists = domain_repo.domain_exists(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST
        )
        assert exists is True

        exists = domain_repo.domain_exists(
            user_id=test_user.user_id,
            domain="notfound.com",
            policy_type=DomainPolicyType.BLACKLIST
        )
        assert exists is False


class TestDomainRepositoryRetrieval:
    """Test data retrieval operations"""

    def test_get_by_user_and_type(self, domain_repo, test_user):
        """Test getting domains by user and type"""
        domains_to_add = ["example.com", "test.com", "github.com"]
        for domain in domains_to_add:
            domain_repo.add_domain(
                user_id=test_user.user_id,
                domain=domain,
                policy_type=DomainPolicyType.BLACKLIST
            )

        retrieved = domain_repo.get_by_user_and_type(
            user_id=test_user.user_id,
            policy_type=DomainPolicyType.BLACKLIST
        )

        assert len(retrieved) == 3
        assert set(retrieved) == set(domains_to_add)

    def test_get_policies_by_user_and_type(self, domain_repo, test_user):
        """Test getting full policy objects"""
        domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="example.com",
            policy_type=DomainPolicyType.BLACKLIST,
            description="Test domain"
        )

        policies = domain_repo.get_policies_by_user_and_type(
            user_id=test_user.user_id,
            policy_type=DomainPolicyType.BLACKLIST
        )

        assert len(policies) == 1
        assert policies[0].domain == "example.com"
        assert policies[0].description == "Test domain"

    def test_get_all_policies_by_user(self, domain_repo, test_user):
        """Test getting all policies (blacklist + whitelist)"""
        domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="black.com",
            policy_type=DomainPolicyType.BLACKLIST
        )
        domain_repo.add_domain(
            user_id=test_user.user_id,
            domain="white.com",
            policy_type=DomainPolicyType.WHITELIST
        )

        all_policies = domain_repo.get_all_policies_by_user(test_user.user_id)

        assert len(all_policies) == 2
        types = {p.policy_type for p in all_policies}
        assert DomainPolicyType.BLACKLIST in types
        assert DomainPolicyType.WHITELIST in types

    def test_count_by_type(self, domain_repo, test_user):
        """Test counting policies by type"""
        for i in range(5):
            domain_repo.add_domain(
                user_id=test_user.user_id,
                domain=f"example{i}.com",
                policy_type=DomainPolicyType.BLACKLIST
            )

        count = domain_repo.count_by_type(
            user_id=test_user.user_id,
            policy_type=DomainPolicyType.BLACKLIST
        )

        assert count == 5


class TestDomainRepositoryBatch:
    """Test batch operations"""

    def test_add_domains_batch(self, domain_repo, test_user):
        """Test batch adding domains"""
        domains = ["a.com", "b.com", "c.com"]
        policies = domain_repo.add_domains_batch(
            user_id=test_user.user_id,
            domains=domains,
            policy_type=DomainPolicyType.BLACKLIST
        )

        assert len(policies) == 3
        retrieved = domain_repo.get_by_user_and_type(
            user_id=test_user.user_id,
            policy_type=DomainPolicyType.BLACKLIST
        )
        assert set(retrieved) == set(domains)

    def test_remove_domains_batch(self, domain_repo, test_user):
        """Test batch removing domains"""
        domains = ["a.com", "b.com", "c.com"]
        domain_repo.add_domains_batch(
            user_id=test_user.user_id,
            domains=domains,
            policy_type=DomainPolicyType.BLACKLIST
        )

        count = domain_repo.remove_domains_batch(
            user_id=test_user.user_id,
            domains=["a.com", "b.com"],
            policy_type=DomainPolicyType.BLACKLIST
        )

        assert count == 2
        remaining = domain_repo.get_by_user_and_type(
            user_id=test_user.user_id,
            policy_type=DomainPolicyType.BLACKLIST
        )
        assert remaining == ["c.com"]


# ========== Service Tests ==========

class TestDomainServiceBlacklist:
    """Test blacklist service operations"""

    def test_add_blacklist_domain(self, domain_service, test_user):
        """Test adding domain via service"""
        result = domain_service.add_blacklist_domain(
            user_id=test_user.user_id,
            domain="example.com"
        )

        assert result["success"] is True
        assert result["domain"] == "example.com"

    def test_remove_blacklist_domain(self, domain_service, test_user):
        """Test removing domain via service"""
        domain_service.add_blacklist_domain(test_user.user_id, "example.com")
        result = domain_service.remove_blacklist_domain(test_user.user_id, "example.com")

        assert result["success"] is True

    def test_get_blacklist_domains(self, domain_service, test_user):
        """Test getting blacklist domains"""
        for domain in ["a.com", "b.com"]:
            domain_service.add_blacklist_domain(test_user.user_id, domain)

        result = domain_service.get_blacklist_domains(test_user.user_id)

        assert result["success"] is True
        assert result["count"] == 2
        assert set(result["blacklist_domains"]) == {"a.com", "b.com"}

    def test_get_blacklist_policies(self, domain_service, test_user):
        """Test getting blacklist policies with details"""
        domain_service.add_blacklist_domain(
            test_user.user_id,
            "example.com",
            description="Test domain"
        )

        result = domain_service.get_blacklist_policies(test_user.user_id)

        assert result["success"] is True
        assert result["count"] == 1
        assert result["policies"][0]["description"] == "Test domain"

    def test_add_blacklist_domains_batch(self, domain_service, test_user):
        """Test batch adding via service"""
        result = domain_service.add_blacklist_domains_batch(
            test_user.user_id,
            ["a.com", "b.com", "c.com"]
        )

        assert result["success"] is True
        assert result["count"] == 3

    def test_remove_blacklist_domains_batch(self, domain_service, test_user):
        """Test batch removing via service"""
        domain_service.add_blacklist_domains_batch(
            test_user.user_id,
            ["a.com", "b.com", "c.com"]
        )

        result = domain_service.remove_blacklist_domains_batch(
            test_user.user_id,
            ["a.com", "b.com"]
        )

        assert result["success"] is True
        assert result["count"] == 2


class TestDomainServiceCheck:
    """Test domain checking logic"""

    def test_should_exclude_domain_true(self, domain_service, test_user):
        """Test checking if domain should be excluded (true case)"""
        domain_service.add_blacklist_domain(test_user.user_id, "example.com")

        result = domain_service.should_exclude_domain(test_user.user_id, "example.com")

        assert result["success"] is True
        assert result["should_exclude"] is True
        assert result["reason"] == "domain_in_blacklist"

    def test_should_exclude_domain_false(self, domain_service, test_user):
        """Test checking if domain should be excluded (false case)"""
        domain_service.add_blacklist_domain(test_user.user_id, "example.com")

        result = domain_service.should_exclude_domain(test_user.user_id, "other.com")

        assert result["success"] is True
        assert result["should_exclude"] is False


class TestDomainServiceStatistics:
    """Test statistics operations"""

    def test_get_statistics(self, domain_service, test_user):
        """Test getting domain statistics"""
        domain_service.add_blacklist_domains_batch(test_user.user_id, ["a.com", "b.com"])
        domain_service.add_whitelist_domain(test_user.user_id, "whitelist.com")

        result = domain_service.get_statistics(test_user.user_id)

        assert result["success"] is True
        assert result["blacklist_count"] == 2
        assert result["whitelist_count"] == 1
        assert result["total_policies"] == 3


# ========== Edge Case Tests ==========

class TestEdgeCases:
    """Test edge cases and error handling"""

    def test_different_users_isolated(self, domain_repo):
        """Test that different users' domains are isolated"""
        user1 = UserModel(user_id="user1")
        user2 = UserModel(user_id="user2")

        db = domain_repo.db
        db.add(user1)
        db.add(user2)
        db.commit()

        domain_repo.add_domain(user1.user_id, "user1.com", DomainPolicyType.BLACKLIST)
        domain_repo.add_domain(user2.user_id, "user2.com", DomainPolicyType.BLACKLIST)

        user1_domains = domain_repo.get_by_user_and_type(user1.user_id, DomainPolicyType.BLACKLIST)
        user2_domains = domain_repo.get_by_user_and_type(user2.user_id, DomainPolicyType.BLACKLIST)

        assert user1_domains == ["user1.com"]
        assert user2_domains == ["user2.com"]

    def test_same_domain_different_types(self, domain_repo, test_user):
        """Test same domain in different policy types"""
        domain_repo.add_domain(test_user.user_id, "example.com", DomainPolicyType.BLACKLIST)
        domain_repo.add_domain(test_user.user_id, "example.com", DomainPolicyType.WHITELIST)

        blacklist = domain_repo.get_by_user_and_type(test_user.user_id, DomainPolicyType.BLACKLIST)
        whitelist = domain_repo.get_by_user_and_type(test_user.user_id, DomainPolicyType.WHITELIST)

        assert "example.com" in blacklist
        assert "example.com" in whitelist

    def test_nonexistent_domain_removal(self, domain_service, test_user):
        """Test removing non-existent domain"""
        result = domain_service.remove_blacklist_domain(test_user.user_id, "notfound.com")

        assert result["success"] is False

    def test_empty_blacklist(self, domain_service, test_user):
        """Test getting empty blacklist"""
        result = domain_service.get_blacklist_domains(test_user.user_id)

        assert result["success"] is True
        assert result["count"] == 0
        assert result["blacklist_domains"] == []


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
