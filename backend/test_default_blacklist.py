"""
Tests for Default Blacklist Initialization

Verifies that new users automatically receive predefined blacklist items
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from infrastructure.models import Base, DomainManagementPolicy, DomainPolicyType
from infrastructure.repositories import UserRepository, DEFAULT_BLACKLIST


@pytest.fixture
def db():
    """Create in-memory SQLite database for testing"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


class TestDefaultBlacklistInitialization:
    """Test suite for default blacklist initialization"""

    def test_new_user_gets_default_blacklist(self, db):
        """New users should automatically receive default blacklist items"""
        repo = UserRepository(db)
        user_id = "test_user_123"

        # Get user (creates new user)
        user = repo.get_user(user_id)

        # Verify user was created
        assert user.user_id == user_id

        # Check blacklist items in database
        blacklist_policies = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST
        ).all()

        # Should have at least the default items
        assert len(blacklist_policies) >= len(DEFAULT_BLACKLIST)
        print(f"✅ Created user with {len(blacklist_policies)} blacklist items")

    def test_default_blacklist_domains_are_present(self, db):
        """All default blacklist domains should be present for new users"""
        repo = UserRepository(db)
        user_id = "test_user_456"

        # Get user (creates new user)
        user = repo.get_user(user_id)

        # Get all blacklist domains
        blacklist_policies = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST
        ).all()

        blacklist_domains = {p.domain for p in blacklist_policies}
        expected_domains = {item["domain"] for item in DEFAULT_BLACKLIST}

        # All default domains should be in the blacklist
        assert expected_domains == blacklist_domains
        print(f"✅ All {len(expected_domains)} default domains present")

    def test_default_blacklist_items_are_active(self, db):
        """All default blacklist items should be active"""
        repo = UserRepository(db)
        user_id = "test_user_789"

        # Get user (creates new user)
        user = repo.get_user(user_id)

        # Check all blacklist items
        blacklist_policies = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST
        ).all()

        # All should be active
        for policy in blacklist_policies:
            assert policy.is_active is True, f"Policy {policy.domain} should be active"

        print(f"✅ All {len(blacklist_policies)} blacklist items are active")

    def test_default_blacklist_items_have_descriptions(self, db):
        """Default blacklist items should have descriptions"""
        repo = UserRepository(db)
        user_id = "test_user_desc"

        # Get user (creates new user)
        user = repo.get_user(user_id)

        # Check blacklist items
        blacklist_policies = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST
        ).all()

        # All should have descriptions
        for policy in blacklist_policies:
            assert policy.description is not None and len(policy.description) > 0, \
                f"Policy {policy.domain} should have description"

        print(f"✅ All {len(blacklist_policies)} blacklist items have descriptions")

    def test_existing_user_no_duplicate_import(self, db):
        """Existing users should not have duplicates on second access"""
        repo = UserRepository(db)
        user_id = "test_user_dup"

        # Get user first time (creates with defaults)
        user1 = repo.get_user(user_id)
        blacklist_count_1 = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST
        ).count()

        # Get user second time (should not reimport)
        user2 = repo.get_user(user_id)
        blacklist_count_2 = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST
        ).count()

        # Counts should be the same (no duplicates)
        assert blacklist_count_1 == blacklist_count_2
        print(f"✅ No duplicates: {blacklist_count_1} items on first access, {blacklist_count_2} on second")

    def test_specific_default_domains_present(self, db):
        """Verify specific important domains are in default blacklist"""
        important_domains = {
            "localhost",
            "127.0.0.1",
            "github.com",
            "facebook.com",
            "youtube.com",
        }

        repo = UserRepository(db)
        user_id = "test_user_important"

        # Get user (creates with defaults)
        user = repo.get_user(user_id)

        # Get all blacklist domains
        blacklist_policies = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST
        ).all()

        blacklist_domains = {p.domain for p in blacklist_policies}

        # Check important domains are present
        for domain in important_domains:
            assert domain in blacklist_domains, f"Important domain {domain} not in blacklist"

        print(f"✅ All important domains present: {important_domains}")

    def test_default_blacklist_count(self, db):
        """Verify correct number of default blacklist items"""
        repo = UserRepository(db)
        user_id = "test_user_count"

        # Get user (creates with defaults)
        user = repo.get_user(user_id)

        # Count blacklist items
        blacklist_count = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST
        ).count()

        # Should match DEFAULT_BLACKLIST length
        assert blacklist_count == len(DEFAULT_BLACKLIST), \
            f"Expected {len(DEFAULT_BLACKLIST)} items, got {blacklist_count}"

        print(f"✅ Correct count: {blacklist_count} items == {len(DEFAULT_BLACKLIST)} defaults")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
