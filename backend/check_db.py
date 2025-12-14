import os
import sys

# Add path to find modules
sys.path.append(os.getcwd())

from infrastructure.database import SessionLocal
from infrastructure.models import UserModel, VocabularyEntryModel


def check_db():
    db = SessionLocal()
    try:
        user_id = "test_user"
        print(f"Checking data for {user_id}...")
        
        user = db.query(UserModel).filter_by(user_id=user_id).first()
        if not user:
             print("User not found!")
             return

        vocab = db.query(VocabularyEntryModel).filter_by(user_id=user_id).all()
        print(f"Found {len(vocab)} vocabulary entries.")
        
        for v in vocab:
             print(f"ID: {v.id}, Word: {v.word}, Status: {v.status}, TotalReviews: {v.total_reviews}, NextReview: {v.next_review}")

    finally:
        db.close()

if __name__ == "__main__":
    check_db()
