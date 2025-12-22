import sqlite3
from pathlib import Path

db_path = "/Users/yinshucheng/code/creo/MixRead/backend/mixread.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

# Test various types of abbreviations and short words
test_words = [
    "usd", "hr", "vp", "ceo", "doc", "app", # Business/Common
    "mon", "tue", "jan", "feb", # Time
    "kg", "cm", "ml", "km", # Units
    "usa", "uk", "un", "eu", # Entities
    "vs", "aka", "etc", "ie", "eg", # Latin/Functional
    "asap", "fyi", "diy", "tba" # Slang/Phrases
]

print(f"{'Word':<10} | {'Ranking':<8} | {'Tag':<15} | {'Translation'}")
print("-" * 80)

for word in test_words:
    c.execute("SELECT word, ranking, tag, translation FROM dictionary WHERE word = ?", (word,))
    row = c.fetchone()
    if row:
        print(f"{row[0]:<10} | {row[1]:<8} | {row[2]:<15} | {row[3].splitlines()[0][:40]}")
    else:
        print(f"{word:<10} | Not found")

conn.close()
