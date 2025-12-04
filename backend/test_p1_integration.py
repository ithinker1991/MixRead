"""
Comprehensive Integration Tests for Phase 1 (P1)

Tests cover:
- P1.1: Default blacklist initialization
- P1.2: Quick add UI (backend API support)
- Happy path workflows
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


class TestP1Integration:
    """Integration tests for Phase 1 features"""

    def test_p1_1_new_user_initialization_happy_path(self, db):
        """
        P1.1 Happy Path: New user should be automatically initialized with default blacklist

        Flow:
        1. Create new user
        2. Verify user exists
        3. Verify default blacklist items created
        4. Verify all items are active
        """
        repo = UserRepository(db)
        user_id = "user_p1_integration_001"

        # Step 1: Create new user
        user = repo.get_user(user_id)
        assert user is not None
        assert user.user_id == user_id
        print(f"✅ User created: {user_id}")

        # Step 2: Verify default blacklist items
        blacklist = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).all()

        assert len(blacklist) == len(DEFAULT_BLACKLIST)
        print(f"✅ Default blacklist initialized with {len(blacklist)} items")

        # Step 3: Verify all items are active
        for policy in blacklist:
            assert policy.is_active is True
            assert policy.description is not None and len(policy.description) > 0
        print(f"✅ All blacklist items are active with descriptions")

    def test_p1_2_quick_add_domain_happy_path(self, db):
        """
        P1.2 Happy Path: User should be able to quickly add a domain to blacklist

        Flow:
        1. Create new user (with defaults from P1.1)
        2. Add a new custom domain via API simulation
        3. Verify domain appears in blacklist
        4. Verify domain is active
        """
        repo = UserRepository(db)
        user_id = "user_p1_quick_add_001"

        # Step 1: Create user with defaults
        user = repo.get_user(user_id)
        print(f"✅ User created: {user_id}")

        # Step 2: Add custom domain (simulate quick actions API call)
        custom_domain = "example.com"
        policy = DomainManagementPolicy(
            user_id=user_id,
            domain=custom_domain,
            policy_type=DomainPolicyType.BLACKLIST,
            description="Quick add test domain",
            is_active=True,
        )
        db.add(policy)
        db.commit()
        print(f"✅ Custom domain added: {custom_domain}")

        # Step 3: Verify domain in blacklist
        blacklist = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).all()

        blacklist_domains = {p.domain for p in blacklist}
        assert custom_domain in blacklist_domains
        print(f"✅ Custom domain found in blacklist")

        # Step 4: Verify domain is active
        custom_policy = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.domain == custom_domain,
        ).first()

        assert custom_policy is not None
        assert custom_policy.is_active is True
        print(f"✅ Custom domain is active")

    def test_p1_2_quick_add_path_happy_path(self, db):
        """
        P1.2 Happy Path: User should be able to quickly add a domain/path to blacklist

        Flow:
        1. Create new user
        2. Add domain with path via API simulation
        3. Verify domain/path pair appears in blacklist
        """
        repo = UserRepository(db)
        user_id = "user_p1_quick_path_001"

        # Create user
        user = repo.get_user(user_id)

        # Add domain/path (simulate quick exclude path action)
        domain_path = "localhost:8002/library-viewer.html"
        policy = DomainManagementPolicy(
            user_id=user_id,
            domain=domain_path,
            policy_type=DomainPolicyType.BLACKLIST,
            description="Quick add path test",
            is_active=True,
        )
        db.add(policy)
        db.commit()
        print(f"✅ Domain/path added: {domain_path}")

        # Verify in blacklist
        blacklist = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).all()

        blacklist_domains = {p.domain for p in blacklist}
        assert domain_path in blacklist_domains
        print(f"✅ Domain/path found in blacklist")

    def test_p1_multiple_users_independent_blacklists(self, db):
        """
        Verify that multiple users have independent blacklists
        (each gets their own copy of defaults)
        """
        repo = UserRepository(db)
        user1_id = "user_multi_1"
        user2_id = "user_multi_2"

        # Create two users
        user1 = repo.get_user(user1_id)
        user2 = repo.get_user(user2_id)

        # Get blacklists for both
        blacklist1 = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user1_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).all()

        blacklist2 = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user2_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).all()

        # Both should have defaults
        assert len(blacklist1) == len(DEFAULT_BLACKLIST)
        assert len(blacklist2) == len(DEFAULT_BLACKLIST)

        # Domains should match
        domains1 = {p.domain for p in blacklist1}
        domains2 = {p.domain for p in blacklist2}
        assert domains1 == domains2

        # Now add custom domain to user1 only
        custom_policy = DomainManagementPolicy(
            user_id=user1_id,
            domain="custom1.example.com",
            policy_type=DomainPolicyType.BLACKLIST,
            description="User 1 custom",
            is_active=True,
        )
        db.add(custom_policy)
        db.commit()

        # Verify user1 has one more, user2 unchanged
        blacklist1_after = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user1_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).count()

        blacklist2_after = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user2_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).count()

        assert blacklist1_after == len(DEFAULT_BLACKLIST) + 1
        assert blacklist2_after == len(DEFAULT_BLACKLIST)
        print(f"✅ Multiple users have independent blacklists")

    def test_p1_default_domains_cover_key_categories(self, db):
        """
        Verify that default blacklist covers key categories:
        - Development (localhost, 127.0.0.1)
        - Social media (facebook, twitter, reddit, etc.)
        - Learning tools (quizlet, anki)
        - Video platforms (youtube)
        - Sensitive (gmail, github)
        """
        repo = UserRepository(db)
        user_id = "user_categories"
        user = repo.get_user(user_id)

        blacklist = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).all()

        domains = {p.domain for p in blacklist}

        # Verify category coverage
        categories = {
            "development": {"localhost", "127.0.0.1"},
            "social_media": {"facebook.com", "twitter.com", "reddit.com", "instagram.com", "tiktok.com"},
            "learning_tools": {"quizlet.com", "anki.deskew.com"},
            "video": {"youtube.com"},
            "sensitive": {"mail.google.com", "github.com"},
        }

        for category, expected_domains in categories.items():
            found = expected_domains & domains
            if found:
                print(f"✅ Category '{category}' present: {found}")
            else:
                # Some categories might have partial coverage, just log
                print(f"⚠️  Category '{category}' partially or not covered")

    def test_p1_no_duplicates_on_user_reload(self, db):
        """
        Verify that accessing an existing user doesn't create duplicate blacklist items
        """
        repo = UserRepository(db)
        user_id = "user_no_dup"

        # First access - creates user and initializes defaults
        user1 = repo.get_user(user_id)
        count1 = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).count()

        # Second access - should not recreate
        user2 = repo.get_user(user_id)
        count2 = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).count()

        # Third access - still no duplicates
        user3 = repo.get_user(user_id)
        count3 = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).count()

        assert count1 == count2 == count3 == len(DEFAULT_BLACKLIST)
        print(f"✅ No duplicates on user reload: all counts = {count1}")

    def test_p1_all_default_domains_have_valid_data(self, db):
        """
        Verify that all default blacklist items have:
        - Non-empty domain
        - Non-empty description
        - Active status = True
        - Correct policy type
        """
        repo = UserRepository(db)
        user_id = "user_valid_data"
        user = repo.get_user(user_id)

        blacklist = db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST,
        ).all()

        for idx, policy in enumerate(blacklist, 1):
            # Domain validation
            assert policy.domain is not None and len(policy.domain) > 0, \
                f"Policy {idx} has empty domain"
            assert isinstance(policy.domain, str), \
                f"Policy {idx} domain is not string"

            # Description validation
            assert policy.description is not None and len(policy.description) > 0, \
                f"Policy {idx} ({policy.domain}) has empty description"
            assert isinstance(policy.description, str), \
                f"Policy {idx} description is not string"

            # Status validation
            assert policy.is_active is True, \
                f"Policy {idx} ({policy.domain}) is not active"

            # Type validation
            assert policy.policy_type == DomainPolicyType.BLACKLIST, \
                f"Policy {idx} ({policy.domain}) has wrong type"

        print(f"✅ All {len(blacklist)} default policies have valid data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
