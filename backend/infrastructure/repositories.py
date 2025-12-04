"""
Repository Pattern Implementation

Provides data access layer using SQLAlchemy ORM
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime
import logging

from domain.models import User, VocabularyEntry, LibraryEntry
from infrastructure.models import (
    UserModel,
    UnknownWordModel,
    VocabularyEntryModel,
    LibraryEntryModel,
    DomainManagementPolicy,
    DomainPolicyType,
)

logger = logging.getLogger(__name__)

# ========== Default Blacklist Definition (Hardcoded) ==========
# These domains will be automatically added to new users' blacklist
DEFAULT_BLACKLIST = [
    # Development environments
    {"domain": "localhost", "description": "Local development server"},
    {"domain": "127.0.0.1", "description": "Local loopback (127.0.0.1)"},

    # Learning tools (distracting from English reading)
    {"domain": "quizlet.com", "description": "Flashcard platform - disable when studying"},
    {"domain": "anki.deskew.com", "description": "Anki web - disable during review"},

    # Social media (distraction)
    {"domain": "facebook.com", "description": "Social media - distraction"},
    {"domain": "twitter.com", "description": "Social media - distraction"},
    {"domain": "reddit.com", "description": "Social media - distraction"},
    {"domain": "instagram.com", "description": "Social media - distraction"},
    {"domain": "tiktok.com", "description": "Social media - distraction"},

    # Video platforms (distraction)
    {"domain": "youtube.com", "description": "Video platform - distraction"},

    # Privacy/Financial sensitive sites
    {"domain": "mail.google.com", "description": "Gmail - privacy sensitive"},

    # Development platforms
    {"domain": "github.com", "description": "Development platform"},
    {"domain": "stackoverflow.com", "description": "Programming Q&A - distraction"},
]


class UserRepository:
    """
    User repository - handles all user data persistence
    Converts between Domain Models and ORM Models
    """

    def __init__(self, db: Session):
        self.db = db

    def get_user(self, user_id: str) -> User:
        """
        Load user from database and convert to domain model

        Args:
            user_id: User ID

        Returns:
            User domain model (creates new if doesn't exist)
        """
        user_model = self.db.query(UserModel).filter(
            UserModel.user_id == user_id
        ).first()

        # Create new user if doesn't exist
        if not user_model:
            user_model = UserModel(user_id=user_id)
            self.db.add(user_model)
            self.db.commit()
            self.db.refresh(user_model)

            # Import default blacklist for new user
            self._import_default_blacklist(user_id)
            logger.info(f"✅ Created new user {user_id} with default blacklist")

        # Convert to domain model
        return self._model_to_domain(user_model)

    def save_user(self, user: User):
        """
        Save user domain model to database

        Args:
            user: User domain model
        """
        user_model = self.db.query(UserModel).filter(
            UserModel.user_id == user.user_id
        ).first()

        if not user_model:
            user_model = UserModel(user_id=user.user_id)
            self.db.add(user_model)

        # Update known words
        user_model.set_known_words(user.known_words)

        # Update unknown words
        current_unknown = self.db.query(UnknownWordModel).filter(
            UnknownWordModel.user_id == user.user_id
        ).all()
        current_unknown_set = {w.word.lower() for w in current_unknown}
        desired_unknown_set = {w.lower() for w in user.unknown_words}

        # Remove words no longer in unknown_words
        for word_model in current_unknown:
            if word_model.word.lower() not in desired_unknown_set:
                self.db.delete(word_model)

        # Add new unknown words
        for word in desired_unknown_set:
            if word not in current_unknown_set:
                unknown_word = UnknownWordModel(user_id=user.user_id, word=word)
                self.db.add(unknown_word)

        # Update vocabulary entries
        current_vocab = self.db.query(VocabularyEntryModel).filter(
            VocabularyEntryModel.user_id == user.user_id
        ).all()
        current_vocab_set = {v.word.lower() for v in current_vocab}
        desired_vocab_set = set(user.vocabulary.keys())

        # Remove words no longer in vocabulary
        for vocab_model in current_vocab:
            if vocab_model.word.lower() not in desired_vocab_set:
                self.db.delete(vocab_model)

        # Update or add vocabulary entries
        for word, entry in user.vocabulary.items():
            vocab_model = next(
                (v for v in current_vocab if v.word.lower() == word.lower()),
                None
            )
            if vocab_model:
                # Update existing
                vocab_model.status = entry.status
                vocab_model.attempt_count = entry.attempt_count
                vocab_model.last_reviewed = entry.last_reviewed
            else:
                # Create new
                vocab_model = VocabularyEntryModel(
                    user_id=user.user_id,
                    word=word,
                    status=entry.status,
                    added_at=entry.added_at
                )
                self.db.add(vocab_model)

        # Update library entries
        current_library = self.db.query(LibraryEntryModel).filter(
            LibraryEntryModel.user_id == user.user_id
        ).all()
        current_library_set = {l.word.lower() for l in current_library}
        desired_library_set = set(user.library.keys())

        # Remove words no longer in library
        for library_model in current_library:
            if library_model.word.lower() not in desired_library_set:
                self.db.delete(library_model)

        # Update or add library entries
        for word, entry in user.library.items():
            library_model = next(
                (l for l in current_library if l.word.lower() == word.lower()),
                None
            )
            if library_model:
                # Update existing
                library_model.status = entry.status
                library_model.set_contexts(entry.contexts)
            else:
                # Create new
                library_model = LibraryEntryModel(
                    user_id=user.user_id,
                    word=word,
                    status=entry.status,
                    added_at=entry.added_at
                )
                library_model.set_contexts(entry.contexts)
                self.db.add(library_model)

        self.db.commit()

    def add_unknown_word(self, user_id: str, word: str):
        """
        Add a word to unknown_words

        Args:
            user_id: User ID
            word: Word to add
        """
        word = word.lower()
        try:
            unknown_word = UnknownWordModel(user_id=user_id, word=word)
            self.db.add(unknown_word)
            self.db.commit()
        except IntegrityError:
            # Word already exists in unknown_words
            self.db.rollback()

    def remove_unknown_word(self, user_id: str, word: str):
        """
        Remove a word from unknown_words

        Args:
            user_id: User ID
            word: Word to remove
        """
        self.db.query(UnknownWordModel).filter(
            UnknownWordModel.user_id == user_id,
            UnknownWordModel.word == word.lower()
        ).delete()
        self.db.commit()

    def get_unknown_words(self, user_id: str) -> set:
        """
        Get all unknown words for a user

        Args:
            user_id: User ID

        Returns:
            Set of unknown words
        """
        unknown_words = self.db.query(UnknownWordModel).filter(
            UnknownWordModel.user_id == user_id
        ).all()
        return {w.word.lower() for w in unknown_words}

    def add_known_word(self, user_id: str, word: str):
        """
        Add a word to known_words (stored in JSON)

        Args:
            user_id: User ID
            word: Word to add
        """
        user_model = self.db.query(UserModel).filter(
            UserModel.user_id == user_id
        ).first()

        if user_model:
            known_words = user_model.get_known_words()
            known_words.add(word.lower())
            user_model.set_known_words(known_words)
            self.db.commit()

    def remove_known_word(self, user_id: str, word: str):
        """
        Remove a word from known_words

        Args:
            user_id: User ID
            word: Word to remove
        """
        user_model = self.db.query(UserModel).filter(
            UserModel.user_id == user_id
        ).first()

        if user_model:
            known_words = user_model.get_known_words()
            known_words.discard(word.lower())
            user_model.set_known_words(known_words)
            self.db.commit()

    def get_known_words(self, user_id: str) -> set:
        """
        Get all known words for a user

        Args:
            user_id: User ID

        Returns:
            Set of known words
        """
        user_model = self.db.query(UserModel).filter(
            UserModel.user_id == user_id
        ).first()

        return user_model.get_known_words() if user_model else set()

    def _model_to_domain(self, user_model: UserModel) -> User:
        """Convert ORM model to domain model"""
        user = User(user_id=user_model.user_id, created_at=user_model.created_at)

        # Load known words
        user.known_words = user_model.get_known_words()

        # Load unknown words
        unknown_word_models = self.db.query(UnknownWordModel).filter(
            UnknownWordModel.user_id == user_model.user_id
        ).all()
        user.unknown_words = {w.word.lower() for w in unknown_word_models}

        # Load vocabulary
        vocab_models = self.db.query(VocabularyEntryModel).filter(
            VocabularyEntryModel.user_id == user_model.user_id
        ).all()

        for vocab_model in vocab_models:
            entry = VocabularyEntry(vocab_model.word, added_at=vocab_model.added_at)
            entry.status = vocab_model.status
            entry.attempt_count = vocab_model.attempt_count
            entry.last_reviewed = vocab_model.last_reviewed
            user.vocabulary[vocab_model.word.lower()] = entry

        # Load library
        library_models = self.db.query(LibraryEntryModel).filter(
            LibraryEntryModel.user_id == user_model.user_id
        ).all()

        for library_model in library_models:
            entry = LibraryEntry(library_model.word, added_at=library_model.added_at)
            entry.status = library_model.status
            entry.contexts = library_model.get_contexts()
            user.library[library_model.word.lower()] = entry

        return user

    def _import_default_blacklist(self, user_id: str):
        """
        Import default blacklist items for new user

        Args:
            user_id: User ID
        """
        try:
            imported_count = 0
            for item in DEFAULT_BLACKLIST:
                try:
                    # Check if domain already exists for this user
                    existing = self.db.query(DomainManagementPolicy).filter(
                        DomainManagementPolicy.user_id == user_id,
                        DomainManagementPolicy.domain == item["domain"],
                        DomainManagementPolicy.policy_type == DomainPolicyType.BLACKLIST
                    ).first()

                    if existing:
                        continue  # Already exists, skip

                    # Create new blacklist policy
                    policy = DomainManagementPolicy(
                        user_id=user_id,
                        domain=item["domain"],
                        policy_type=DomainPolicyType.BLACKLIST,
                        description=item.get("description"),
                        is_active=True
                    )
                    self.db.add(policy)
                    imported_count += 1
                except Exception as e:
                    logger.error(f"❌ Failed to import blacklist item {item['domain']}: {e}")

            self.db.commit()
            logger.info(f"✅ Imported {imported_count} default blacklist items for user {user_id}")
        except Exception as e:
            logger.error(f"❌ Failed to import default blacklist: {e}")
            self.db.rollback()


class DomainManagementPolicyRepository:
    """
    Domain Management Policy repository - handles domain policy data persistence
    Provides methods for managing blacklist/whitelist policies
    """

    def __init__(self, db: Session):
        self.db = db

    # ========== 获取策略 ==========

    def get_by_user_and_type(
        self,
        user_id: str,
        policy_type: DomainPolicyType,
    ) -> List[str]:
        """
        获取用户指定类型的所有域名（活跃的）

        Args:
            user_id: User ID
            policy_type: BLACKLIST or WHITELIST

        Returns:
            List of domain names
        """
        domains = self.db.query(DomainManagementPolicy.domain).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == policy_type,
            DomainManagementPolicy.is_active == True,
        ).all()
        return [d[0] for d in domains]

    def get_policies_by_user_and_type(
        self,
        user_id: str,
        policy_type: DomainPolicyType,
    ) -> List[DomainManagementPolicy]:
        """
        获取用户指定类型的所有策略对象（包含完整信息）

        Args:
            user_id: User ID
            policy_type: BLACKLIST or WHITELIST

        Returns:
            List of DomainManagementPolicy objects
        """
        return self.db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == policy_type,
            DomainManagementPolicy.is_active == True,
        ).order_by(DomainManagementPolicy.added_at.desc()).all()

    def get_all_policies_by_user(self, user_id: str) -> List[DomainManagementPolicy]:
        """
        获取用户所有活跃策略（黑名单 + 白名单）

        Args:
            user_id: User ID

        Returns:
            List of all active DomainManagementPolicy objects
        """
        return self.db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.is_active == True,
        ).order_by(
            DomainManagementPolicy.policy_type,
            DomainManagementPolicy.added_at.desc(),
        ).all()

    # ========== 添加策略 ==========

    def add_domain(
        self,
        user_id: str,
        domain: str,
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST,
        description: Optional[str] = None,
    ) -> DomainManagementPolicy:
        """
        添加域名到指定策略

        Args:
            user_id: User ID
            domain: Domain name to add
            policy_type: BLACKLIST or WHITELIST
            description: Optional description

        Returns:
            DomainManagementPolicy object (created or reactivated)
        """
        # 检查是否已存在
        existing = self.db.query(DomainManagementPolicy).filter_by(
            user_id=user_id,
            policy_type=policy_type,
            domain=domain,
        ).first()

        if existing:
            # 如果已存在但被禁用，则启用它
            if not existing.is_active:
                existing.is_active = True
                existing.updated_at = datetime.now()
                self.db.commit()
                self.db.refresh(existing)
            return existing

        # 创建新策略
        policy = DomainManagementPolicy(
            user_id=user_id,
            domain=domain,
            policy_type=policy_type,
            description=description,
        )
        self.db.add(policy)
        self.db.commit()
        self.db.refresh(policy)
        return policy

    # ========== 删除策略 ==========

    def remove_domain(
        self,
        user_id: str,
        domain: str,
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST,
    ) -> bool:
        """
        删除域名（软删除，设置为不活跃）

        Args:
            user_id: User ID
            domain: Domain name to remove
            policy_type: BLACKLIST or WHITELIST

        Returns:
            True if domain was removed, False if not found
        """
        policy = self.db.query(DomainManagementPolicy).filter_by(
            user_id=user_id,
            policy_type=policy_type,
            domain=domain,
        ).first()

        if policy:
            policy.is_active = False
            policy.updated_at = datetime.now()
            self.db.commit()
            return True
        return False

    def hard_delete_domain(
        self,
        user_id: str,
        domain: str,
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST,
    ) -> bool:
        """
        永久删除域名（硬删除）

        Args:
            user_id: User ID
            domain: Domain name to delete
            policy_type: BLACKLIST or WHITELIST

        Returns:
            True if domain was deleted, False if not found
        """
        policy = self.db.query(DomainManagementPolicy).filter_by(
            user_id=user_id,
            policy_type=policy_type,
            domain=domain,
        ).first()

        if policy:
            self.db.delete(policy)
            self.db.commit()
            return True
        return False

    # ========== 检查和验证 ==========

    def domain_exists(
        self,
        user_id: str,
        domain: str,
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST,
    ) -> bool:
        """
        检查域名是否在指定策略中

        Args:
            user_id: User ID
            domain: Domain name to check
            policy_type: BLACKLIST or WHITELIST

        Returns:
            True if domain exists in the policy type, False otherwise
        """
        exists = self.db.query(DomainManagementPolicy).filter_by(
            user_id=user_id,
            policy_type=policy_type,
            domain=domain,
            is_active=True,
        ).first()
        return exists is not None

    # ========== 统计 ==========

    def count_by_type(
        self,
        user_id: str,
        policy_type: DomainPolicyType,
    ) -> int:
        """
        统计用户指定类型的活跃策略数量

        Args:
            user_id: User ID
            policy_type: BLACKLIST or WHITELIST

        Returns:
            Count of active policies
        """
        return self.db.query(DomainManagementPolicy).filter(
            DomainManagementPolicy.user_id == user_id,
            DomainManagementPolicy.policy_type == policy_type,
            DomainManagementPolicy.is_active == True,
        ).count()

    # ========== 批量操作 ==========

    def add_domains_batch(
        self,
        user_id: str,
        domains: List[str],
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST,
    ) -> List[DomainManagementPolicy]:
        """
        批量添加域名

        Args:
            user_id: User ID
            domains: List of domain names to add
            policy_type: BLACKLIST or WHITELIST

        Returns:
            List of created/reactivated DomainManagementPolicy objects
        """
        results = []
        for domain in domains:
            policy = self.add_domain(user_id, domain, policy_type)
            results.append(policy)
        return results

    def remove_domains_batch(
        self,
        user_id: str,
        domains: List[str],
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST,
    ) -> int:
        """
        批量删除域名

        Args:
            user_id: User ID
            domains: List of domain names to remove
            policy_type: BLACKLIST or WHITELIST

        Returns:
            Count of removed domains
        """
        count = 0
        for domain in domains:
            if self.remove_domain(user_id, domain, policy_type):
                count += 1
        return count
