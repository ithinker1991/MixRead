import sqlite3
from pathlib import Path

db_path = "/Users/yinshucheng/code/creo/MixRead/backend/mixread.db"
conn = sqlite3.connect(db_path)
c = conn.cursor()

words = ["kkk", "codex", "pdf", "ecs", "login", "xue", "xing", "https", "htm", "png"]

print(f"{'Word':<15} | {'Ranking':<8} | {'Tag':<20} | {'Translation':<30}")
print("-" * 80)

for word in words:
    c.execute("SELECT word, ranking, tag, translation FROM dictionary WHERE word = ?", (word,))
    row = c.fetchone()
    if row:
        print(f"{row[0]:<15} | {row[1]:<8} | {row[2]:<20} | {row[3][:30]}")
    else:
        print(f"{word:<15} | Not found")

conn.close()
