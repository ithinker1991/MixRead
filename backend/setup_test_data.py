import json
import sys

import requests

BASE_URL = "http://localhost:8000"
USER_ID = "test_user"

def setup_test_data():
    print(f"Setting up test data for {USER_ID}...")
    
    # 1. Check user health/existence (implicitly via get vocabulary)
    print("Checking vocabulary...")
    try:
        resp = requests.get(f"{BASE_URL}/users/{USER_ID}/vocabulary")
        if resp.status_code == 200:
            vocab = resp.json().get("vocabulary", {})
            print(f"User has {len(vocab)} words in vocabulary.")
            
            if len(vocab) < 5:
                print("Adding more words to vocabulary...")
                words_to_add = ["serendipity", "ephemeral", "obfuscate", "eloquent", "resilient"]
                for word in words_to_add:
                    requests.post(f"{BASE_URL}/users/{USER_ID}/vocabulary", json={"word": word})
                print("Added test words.")
            else:
                print("Vocabulary sufficient.")
            # Force one word to be due for review
            print("Forcing a word to be due...")
            # We need direct DB access for this or an endpoint? 
            # We can use update vocabulary endpoint but that might not set next_review.
            # Let's use the check_db approach but write:
            from datetime import datetime, timedelta

            from infrastructure.database import SessionLocal
            from infrastructure.models import VocabularyEntryModel
            
            db = SessionLocal()
            try:
                entry = db.query(VocabularyEntryModel).filter_by(user_id=USER_ID).first()
                if entry:
                    print(f"Resetting word '{entry.word}' to be due now.")
                    entry.next_review = datetime.now() - timedelta(hours=1)
                    entry.total_reviews = 0 # Also make it look new optionally? No, keep logic separate. 
                    # If we want it to be DUE, just next_review in past is enough.
                    db.commit()
            except Exception as e:
                print(f"Failed to force due: {e}")
            finally:
                db.close()

    except Exception as e:
        print(f"Error connecting to backend: {e}")
        return False

    return True

if __name__ == "__main__":
    if setup_test_data():
        print("Test data setup complete.")
    else:
        print("Test data setup failed.")
        sys.exit(1)
