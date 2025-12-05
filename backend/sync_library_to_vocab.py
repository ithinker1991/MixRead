#!/usr/bin/env python3
"""
Sync library entries to vocabulary entries for review

This script copies all words from library_entries to vocabulary_entries
so they can be used in the spaced repetition review system.
"""
import sys
sys.path.insert(0, '/Users/yinshucheng/code/creo/MixRead/backend')

from infrastructure.database import SessionLocal
from infrastructure.models import LibraryEntryModel, VocabularyEntryModel
from domain.models import VocabularyStatus
from datetime import datetime

USER_ID = 'user_1764832659154_2oy43ix7v'

db = SessionLocal()

try:
    # Get all library entries for the user
    library_entries = db.query(LibraryEntryModel).filter_by(user_id=USER_ID).all()
    print(f"📚 Found {len(library_entries)} words in library for {USER_ID}")
    
    synced_count = 0
    skipped_count = 0
    
    for lib_entry in library_entries:
        # Check if word already exists in vocabulary
        existing_vocab = db.query(VocabularyEntryModel).filter_by(
            user_id=USER_ID,
            word=lib_entry.word
        ).first()
        
        if existing_vocab:
            print(f"  ⏭️  Skipping '{lib_entry.word}' - already in vocabulary")
            skipped_count += 1
            continue
        
        # Create new vocabulary entry
        vocab_entry = VocabularyEntryModel(
            user_id=USER_ID,
            word=lib_entry.word,
            status=VocabularyStatus.LEARNING,
            added_at=lib_entry.added_at or datetime.now(),
            next_review=datetime.now(),  # Available for review immediately
            review_interval=0,
            total_reviews=0,
            correct_reviews=0,
            review_streak=0,
            ease_factor=2.5
        )
        
        db.add(vocab_entry)
        synced_count += 1
        print(f"  ✅ Added '{lib_entry.word}' to vocabulary")
    
    # Commit all changes
    db.commit()
    
    print(f"\n🎉 Sync complete!")
    print(f"  ✅ Synced: {synced_count} words")
    print(f"  ⏭️  Skipped: {skipped_count} words (already in vocabulary)")
    print(f"\n📊 User now has {synced_count} words available for review!")
    
except Exception as e:
    print(f"\n❌ Error during sync: {e}")
    db.rollback()
finally:
    db.close()
