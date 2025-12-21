from infrastructure.database import SessionLocal
from infrastructure.models import LibraryEntryModel, VocabularyEntryModel

db = SessionLocal()
user_id = 'test_user'

vocab_words = db.query(VocabularyEntryModel).filter_by(user_id=user_id).all()
library_words = db.query(LibraryEntryModel).filter_by(user_id=user_id).all()

print(f"User: {user_id}")
print(f"Vocabulary words ({len(vocab_words)}):")
for v in vocab_words:
    print(f"  - {v.word}: total_reviews={v.total_reviews}, status={v.status}, next_review={v.next_review}")
print(f"Library words ({len(library_words)}): {[l.word for l in library_words]}")

db.close()
