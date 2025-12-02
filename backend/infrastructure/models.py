"""
SQLAlchemy ORM Models

Maps domain concepts to database tables
"""

from sqlalchemy import Column, String, DateTime, Text, Integer, Enum as SQLEnum, ForeignKey, Index, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import json
from enum import Enum
from domain.models import VocabularyStatus

from infrastructure.database import Base


# ========== Domain Management Policy Enums ==========

class DomainPolicyType(str, Enum):
    """域名管理策略类型"""
    BLACKLIST = "blacklist"  # 黑名单: 这些网站不高亮
    WHITELIST = "whitelist"  # 白名单: 只有这些网站高亮


class UserModel(Base):
    """User table"""
    __tablename__ = "users"

    user_id = Column(String(255), primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.now, index=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Store known_words as JSON
    known_words_json = Column(Text, default="[]")

    # Relationships
    unknown_words = relationship("UnknownWordModel", back_populates="user", cascade="all, delete-orphan")
    vocabulary_entries = relationship("VocabularyEntryModel", back_populates="user", cascade="all, delete-orphan")
    library_entries = relationship("LibraryEntryModel", back_populates="user", cascade="all, delete-orphan")
    domain_management_policies = relationship("DomainManagementPolicy", back_populates="user", cascade="all, delete-orphan")

    def get_known_words(self) -> set:
        """Get known words as a set"""
        try:
            return set(json.loads(self.known_words_json) or [])
        except:
            return set()

    def set_known_words(self, words: set):
        """Set known words from a set"""
        self.known_words_json = json.dumps(list(words))

    def __repr__(self):
        return f"<UserModel user_id={self.user_id}>"


class UnknownWordModel(Base):
    """Unknown words table - words user marked as not knowing"""
    __tablename__ = "unknown_words"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), ForeignKey("users.user_id"), index=True)
    word = Column(String(255), index=True)
    marked_at = Column(DateTime, default=datetime.now)

    # Add unique constraint on user_id + word
    __table_args__ = (
        Index("ix_user_word_unknown", "user_id", "word", unique=True),
    )

    # Relationship
    user = relationship("UserModel", back_populates="unknown_words")

    def __repr__(self):
        return f"<UnknownWordModel user_id={self.user_id} word={self.word}>"


class VocabularyEntryModel(Base):
    """Vocabulary entries table - words user wants to learn"""
    __tablename__ = "vocabulary_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), ForeignKey("users.user_id"), index=True)
    word = Column(String(255), index=True)
    status = Column(SQLEnum(VocabularyStatus), default=VocabularyStatus.LEARNING)
    added_at = Column(DateTime, default=datetime.now)
    last_reviewed = Column(DateTime, nullable=True)
    attempt_count = Column(Integer, default=0)

    # Add unique constraint on user_id + word
    __table_args__ = (
        Index("ix_user_word_vocabulary", "user_id", "word", unique=True),
    )

    # Relationship
    user = relationship("UserModel", back_populates="vocabulary_entries")

    def __repr__(self):
        return f"<VocabularyEntryModel user_id={self.user_id} word={self.word} status={self.status}>"


class LibraryEntryModel(Base):
    """Library entries table - words user wants to learn with context"""
    __tablename__ = "library_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), ForeignKey("users.user_id"), index=True)
    word = Column(String(255), index=True)
    status = Column(SQLEnum(VocabularyStatus), default=VocabularyStatus.LEARNING)
    added_at = Column(DateTime, default=datetime.now)
    contexts_json = Column(Text, default="[]")  # Store contexts as JSON

    # Add unique constraint on user_id + word
    __table_args__ = (
        Index("ix_user_word_library", "user_id", "word", unique=True),
    )

    # Relationship
    user = relationship("UserModel", back_populates="library_entries")

    def get_contexts(self) -> list:
        """Get contexts as a list"""
        try:
            return json.loads(self.contexts_json) or []
        except:
            return []

    def set_contexts(self, contexts: list):
        """Set contexts from a list"""
        self.contexts_json = json.dumps(contexts)

    def __repr__(self):
        return f"<LibraryEntryModel user_id={self.user_id} word={self.word} status={self.status}>"


class DomainManagementPolicy(Base):
    """
    域名管理策略表
    支持黑名单、白名单等多种策略
    """
    __tablename__ = "domain_management_policies"

    # 主键
    id = Column(Integer, primary_key=True, index=True)

    # 用户关联
    user_id = Column(String(255), ForeignKey("users.user_id"), index=True)

    # 策略类型 (黑名单/白名单)
    policy_type = Column(SQLEnum(DomainPolicyType), default=DomainPolicyType.BLACKLIST, index=True)

    # 域名
    domain = Column(String(255), index=True)

    # 是否启用 (便于禁用而不删除)
    is_active = Column(Boolean, default=True, index=True)

    # 添加时间
    added_at = Column(DateTime, default=datetime.now)

    # 修改时间
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 备注 (便于管理)
    description = Column(String(500), nullable=True)

    # 联合唯一约束: 同一用户的同一策略类型中，域名不重复
    __table_args__ = (
        Index("ix_user_policy_domain", "user_id", "policy_type", "domain", unique=True),
        Index("ix_user_policy_active", "user_id", "policy_type", "is_active"),
    )

    # 关系
    user = relationship("UserModel", back_populates="domain_management_policies")

    def __repr__(self):
        return f"<DomainManagementPolicy user={self.user_id} type={self.policy_type} domain={self.domain}>"
