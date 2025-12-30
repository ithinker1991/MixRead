"""
Domain Models for MixRead

Domain layer contains pure business logic and entities
No dependencies on ORM, database, or infrastructure
"""

from datetime import datetime
from enum import Enum


class VocabularyStatus(Enum):
    """Vocabulary learning status"""
    LEARNING = "learning"
    REVIEWING = "reviewing"
    MASTERED = "mastered"


class Word:
    """Word entity - represents a single word with its properties"""

    CEFR_RANKS = {
        "A1": 1,
        "A2": 2,
        "B1": 3,
        "B2": 4,
        "C1": 5,
        "C2": 6
    }

    def __init__(self, text: str, cefr_level: str, pos: str = None):
        self.text = text
        self.cefr_level = cefr_level
        self.pos = pos

    def get_difficulty_rank(self) -> int:
        """Get numeric difficulty rank for comparison"""
        return self.CEFR_RANKS.get(self.cefr_level, 0)

    def __eq__(self, other):
        if isinstance(other, Word):
            return self.text.lower() == other.text.lower()
        return False

    def __hash__(self):
        return hash(self.text.lower())


class VocabularyEntry:
    """Vocabulary entry - represents a word user wants to learn (Unified with Library)"""

    def __init__(self, word: str, added_at: datetime = None):
        self.word = word.lower()
        self.added_at = added_at or datetime.now()
        self.status = VocabularyStatus.LEARNING
        self.attempt_count = 0
        self.last_reviewed = None
        self.contexts = []  # List of context objects (sentence, url, etc.)

    def add_context(self, context: dict):
        """Add learning context"""
        self.contexts.append(context)

    def get_contexts(self) -> list:
        """Get all learning contexts"""
        return self.contexts

    def mark_reviewed(self):
        """Mark this entry as reviewed"""
        self.last_reviewed = datetime.now()
        self.attempt_count += 1

    def mark_mastered(self):
        """Mark this entry as mastered"""
        self.status = VocabularyStatus.MASTERED
        self.mark_reviewed()


# LibraryEntry is unified into VocabularyEntry
class LibraryEntry(VocabularyEntry):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)


class User:
    """User entity - represents a MixRead user"""

    def __init__(self, user_id: str, created_at: datetime = None, google_id: str = None, email: str = None, avatar_url: str = None):
        self.user_id = user_id
        self.created_at = created_at or datetime.now()
        
        # Auth fields
        self.google_id = google_id
        self.email = email
        self.avatar_url = avatar_url

        # Three independent lists for highlighting logic
        self.known_words: set = set()  # Words user confirmed they know
        self.unknown_words: set = set()  # Words user marked as not knowing
        self.vocabulary: dict = {}  # Unified storage for learning words (VocabularyEntry)

    def add_known_word(self, word: str):
        """Mark a word as known"""
        word_lower = word.lower()
        self.known_words.add(word_lower)
        # Remove from unknown words if present
        self.unknown_words.discard(word_lower)

    def add_unknown_word(self, word: str):
        """Mark a word as not knowing"""
        word_lower = word.lower()
        self.unknown_words.add(word_lower)
        # Remove from known words if present
        self.known_words.discard(word_lower)
        # Remove from vocabulary if present
        self.vocabulary.pop(word_lower, None)

    def remove_known_word(self, word: str):
        """Remove a word from known list"""
        self.known_words.discard(word.lower())

    def remove_unknown_word(self, word: str):
        """Remove a word from unknown list"""
        self.unknown_words.discard(word.lower())

    def add_to_vocabulary(self, word: str):
        """Add a word to vocabulary for learning"""
        word_lower = word.lower()
        if word_lower not in self.vocabulary:
            self.vocabulary[word_lower] = VocabularyEntry(word_lower)
        # Remove from unknown words
        self.unknown_words.discard(word_lower)

    def remove_from_vocabulary(self, word: str):
        """Remove a word from vocabulary"""
        self.vocabulary.pop(word.lower(), None)

    def move_unknown_to_vocabulary(self, word: str):
        """Move a word from unknown_words to vocabulary (user decides to learn it)"""
        word_lower = word.lower()
        if word_lower in self.unknown_words:
            self.unknown_words.discard(word_lower)
            self.add_to_vocabulary(word_lower)

    def add_to_library(self, words: list, contexts: list = None):
        """Add words to library with learning context (Unified: points to vocabulary)"""
        for i, word in enumerate(words):
            word_lower = word.lower()
            
            # Use unified vocabulary storage
            if word_lower not in self.vocabulary:
                self.vocabulary[word_lower] = VocabularyEntry(word_lower)
            
            # Mark it as a vocabulary entry
            self.unknown_words.discard(word_lower)

            # Add contexts if provided
            entry = self.vocabulary[word_lower]
            if contexts:
                # If we have the same number of words and contexts, associate 1:1
                if len(words) == len(contexts):
                    entry.add_context(contexts[i])
                # If we have multiple contexts for a single word
                elif len(words) == 1:
                    for ctx in contexts:
                        entry.add_context(ctx)
                # Fallback: just add if index matches
                elif i < len(contexts):
                    entry.add_context(contexts[i])

    def remove_from_library(self, word: str):
        """Remove a word from library (Unified: remove from vocabulary)"""
        self.remove_from_vocabulary(word)

    def get_library_with_context(self) -> list:
        """Get library words with their contexts (Unified: from vocabulary)"""
        result = []
        for word_lower, entry in self.vocabulary.items():
            # Only include if it has contexts or we want all vocabulary in library view
            # For now, let's treat all vocabulary as "library" items for maximum consistency
            result.append({
                "word": word_lower,
                "added_at": entry.added_at.isoformat() if entry.added_at else None,
                "status": entry.status.value,
                "contexts": entry.get_contexts()
            })
        return result
