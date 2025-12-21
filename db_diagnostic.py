import os
import sys

# Add backend to path
backend_path = os.path.abspath(os.path.join(os.getcwd(), 'backend'))
sys.path.insert(0, backend_path)

from infrastructure.database import SessionLocal
from infrastructure.models import LibraryEntryModel, UnknownWordModel, UserModel


def check_user(user_id):
    db = SessionLocal()
    try:
        user = db.query(UserModel).filter_by(user_id=user_id).first()
        if not user:
            print(f"❌ User {user_id} not found in database")
            return

        print(f"👤 User: {user_id}")
        print(f"📅 Created at: {user.created_at}")
        
        known_words = user.get_known_words()
        print(f"✅ Known words ({len(known_words)}): {list(known_words)}")

        unknown_words = db.query(UnknownWordModel).filter_by(user_id=user_id).all()
        print(f"❓ Unknown words ({len(unknown_words)}): {[w.word for w in unknown_words]}")

        library_entries = db.query(LibraryEntryModel).filter_by(user_id=user_id).all()
        print(f"📚 Library entries ({len(library_entries)}):")
        for entry in library_entries:
            print(f"  - {entry.word} (contexts: {len(entry.get_contexts())})")

    finally:
        db.close()

if __name__ == "__main__":
    user_id = sys.argv[1] if len(sys.argv) > 1 else "test_user"
    check_user(user_id)
