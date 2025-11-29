"""
SQLAlchemy ORM Models

Maps domain concepts to database tables
"""

from sqlalchemy import Column, String, DateTime, Text, Integer, Enum as SQLEnum, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import json
from enum import Enum

from infrastructure.database import Base


class VocabularyStatus(Enum):
    """Vocabulary learning status"""
    LEARNING = "learning"
    REVIEWING = "reviewing"
    MASTERED = "mastered"


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
