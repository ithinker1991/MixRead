"""
Repository Pattern Implementation

Provides data access layer using SQLAlchemy ORM
"""

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from domain.models import User, VocabularyEntry
from infrastructure.models import UserModel, UnknownWordModel, VocabularyEntryModel


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

        return user
