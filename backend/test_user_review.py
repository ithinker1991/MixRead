#!/usr/bin/env python3
"""
Test review session for a specific user
"""
import sys
sys.path.insert(0, '/Users/yinshucheng/code/creo/MixRead/backend')

from infrastructure.database import SessionLocal
from infrastructure.repositories import VocabularyRepository
from application.srs_adapter import VocabularyReviewProvider
from srs_core.models import ReviewSession, LearningStatus

USER_ID = 'user_1764832659154_2oy43ix7v'

db = SessionLocal()

try:
    # Create repository with user_id
    vocab_repo = VocabularyRepository(db, USER_ID)
    provider = VocabularyReviewProvider(vocab_repo)
    
    # Create review session
    session = ReviewSession(provider)
    
    # Build mixed session
    status_list = [LearningStatus.DUE, LearningStatus.NEW]
    limits = {LearningStatus.DUE: 20, LearningStatus.NEW: 5}
    
    success = session.build_session(status_list, limits)
    
    if success:
        print(f"✅ Review session created successfully!")
        print(f"📊 Total cards in session: {len(session.cards)}")
        
        # Show first card
        first_card = session.get_current_card()
        if first_card:
            print(f"\n🎯 First card:")
            print(f"  Word: {first_card.content.get('word', 'N/A')}")
            print(f"  Status: {first_card.status.value}")
        
        print(f"\n✨ User can now start reviewing!")
    else:
        print(f"❌ Failed to build review session")
        print(f"This might mean no cards are available for review.")
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
