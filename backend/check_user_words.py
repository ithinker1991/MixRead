#!/usr/bin/env python3
"""
Check library and vocabulary entries for a specific user
"""
import sys
sys.path.insert(0, '/Users/yinshucheng/code/creo/MixRead/backend')

from infrastructure.database import SessionLocal
from infrastructure.models import LibraryEntryModel, VocabularyEntryModel

USER_ID = 'user_1764832659154_2oy43ix7v'

db = SessionLocal()

# Check library entries
library_count = db.query(LibraryEntryModel).filter_by(user_id=USER_ID).count()
print(f"📚 Library entries for {USER_ID}: {library_count}")

if library_count > 0:
    print("\nFirst 10 words in library:")
    library_words = db.query(LibraryEntryModel).filter_by(user_id=USER_ID).limit(10).all()
    for entry in library_words:
        print(f"  - {entry.word} (added: {entry.added_at})")

# Check vocabulary entries
vocab_count = db.query(VocabularyEntryModel).filter_by(user_id=USER_ID).count()
print(f"\n🎯 Vocabulary entries for {USER_ID}: {vocab_count}")

if vocab_count > 0:
    print("\nFirst 10 words in vocabulary:")
    vocab_words = db.query(VocabularyEntryModel).filter_by(user_id=USER_ID).limit(10).all()
    for entry in vocab_words:
        print(f"  - {entry.word} (status: {entry.status}, total_reviews: {entry.total_reviews})")

db.close()

if library_count > 0 and vocab_count == 0:
    print("\n⚠️  ISSUE FOUND: User has library entries but NO vocabulary entries!")
    print("This means words are in the library but not available for review.")
