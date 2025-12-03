"""
Cleanup script to remove bad sentences from library entries

This script filters out sentences that:
- Contain gibberish patterns like "1×", "span(1×)", etc.
- Have excessive special characters
- Don't meet minimum quality requirements
"""

import json
from sqlalchemy.orm import Session
from infrastructure.database import SessionLocal
from infrastructure.models import LibraryEntryModel


def is_bad_sentence(sentence: str) -> bool:
    """Check if a sentence should be filtered out"""
    if not isinstance(sentence, str):
        return True

    # Skip very short sentences
    if len(sentence) < 10:
        return True

    # Skip if less than 3 words
    if len(sentence.split()) < 3:
        return True

    # Check for gibberish patterns
    if 'span(' in sentence or '1×' in sentence or '(1×)' in sentence:
        return True

    # Check for excessive special characters
    special_chars = sentence.count('×') + sentence.count('→') + sentence.count('[') + sentence.count(']')
    if special_chars > 2:
        return True

    # Check for patterns like "word(1×)" or "word(2×)"
    import re
    if re.search(r'\(\d+×\)', sentence):
        return True

    # CRITICAL: Check for multiple word-form patterns like "word(1×)" scattered throughout
    word_form_count = len(re.findall(r'\([0-9×]+\)', sentence))
    if word_form_count > 3:
        return True

    # Check for non-ASCII characters (Chinese, Japanese, etc.)
    if re.search(r'[\u4E00-\u9FFF\u3040-\u309F]', sentence):
        return True

    return False


def cleanup_library_entries(db: Session):
    """Clean up all library entries, removing bad sentences"""

    # Get all library entries
    entries = db.query(LibraryEntryModel).all()
    print(f"Found {len(entries)} library entries")

    cleaned_count = 0
    total_sentences_removed = 0

    for entry in entries:
        contexts = entry.get_contexts()
        original_count = len(contexts)

        if not contexts:
            continue

        # Filter out bad sentences from contexts
        cleaned_contexts = []
        for context in contexts:
            if isinstance(context, dict) and 'sentence' in context:
                if not is_bad_sentence(context['sentence']):
                    cleaned_contexts.append(context)
            elif isinstance(context, str):
                if not is_bad_sentence(context):
                    cleaned_contexts.append(context)

        removed_count = original_count - len(cleaned_contexts)

        if removed_count > 0:
            entry.set_contexts(cleaned_contexts)
            cleaned_count += 1
            total_sentences_removed += removed_count
            print(f"  {entry.word} ({entry.user_id}): removed {removed_count}/{original_count} bad sentences")

    # Commit changes
    db.commit()

    print(f"\nCleanup complete:")
    print(f"  Entries with bad sentences removed: {cleaned_count}")
    print(f"  Total bad sentences removed: {total_sentences_removed}")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        cleanup_library_entries(db)
        print("\n✅ Database cleanup complete!")
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        db.rollback()
    finally:
        db.close()
