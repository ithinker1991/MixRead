#!/usr/bin/env python3
"""
Download FULL ECDICT and extract Top 30k Core Vocabulary
Also creates a SQLite database for the full 770k dictionary (Tier 2)
"""

import csv
import json
import math
import os
import sqlite3
import time
from io import StringIO
from pathlib import Path

import httpx

# Config
TOP_N = 30000
ECDICT_URL = "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
DATA_DIR = Path(__file__).parent / "data"
OUTPUT_JSON = DATA_DIR / "cefr_words.json"  # Overwrite existing core library
OUTPUT_DB = Path(__file__).parent / "mixread.db"  # Main app database

def download_and_process():
    print("=" * 70)
    print(f"🚀 MixRead Vocabulary Builder (Target: Top {TOP_N})")
    print("=" * 70)

    # 1. Download Full Dictionary
    print(f"\n📥 Downloading full ECDICT database...")
    print(f"   Source: {ECDICT_URL}")
    
    try:
        with httpx.stream("GET", ECDICT_URL, timeout=300.0, follow_redirects=True) as response:
            response.raise_for_status()
            content = response.text
            print("✅ Download complete! Processing...")
            
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return

    # 2. Process CSV
    print("\n🔄 Parsing CSV and analyzing frequencies...")
    csv.field_size_limit(1000000)
    reader = csv.DictReader(StringIO(content), delimiter=',')
    
    all_words = []
    
    for row in reader:
        word = row.get('word', '').strip()
        if not word: continue
        
        # Parse frequency
        # frq: COCA frequency (correction), bnc: BNC frequency
        try:
            frq = int(row.get('frq', 0))
            bnc = int(row.get('bnc', 0))
        except:
            frq = 0
            bnc = 0
            
        # Composite score for ranking (prefer frq, fallback to bnc)
        if frq > 0:
            rank_score = frq
        elif bnc > 0:
            rank_score = bnc
        else:
            rank_score = 9999999 # No frequency data
            
        # Parse tags
        tags = row.get('tag', '').split(' ')
        
        entry = {
            'word': word,
            'pos': row.get('pos', ''),
            'translation': row.get('translation', ''),
            'definition': row.get('definition', ''),
            'tag': row.get('tag', ''),
            'frq': frq,
            'bnc': bnc,
            'rank_score': rank_score,
            'phonetic': row.get('phonetic', '')
        }
        all_words.append(entry)

    print(f"   Total entries found: {len(all_words):,}")

    # 3. Sort by rank (Lower score is better/more frequent)
    # Filter out words with no frequency data for the Top N list
    ranked_words = [w for w in all_words if w['rank_score'] < 9999999]
    ranked_words.sort(key=lambda x: x['rank_score'])
    
    print(f"   Words with frequency data: {len(ranked_words):,}")

    # 4. Extract Top N (Tier 1)
    tier1_words = ranked_words[:TOP_N]
    print(f"\n✅ Extracted Top {len(tier1_words):,} words for Core Library")
    
    # 5. Build JSON Structure
    core_library = {}
    
    for rank, entry in enumerate(tier1_words, 1):
        word = entry['word']
        
        # Identify CEFR/Exam levels from tags
        tags = entry['tag'].split(' ')
        cefr = "Unknown"
        if 'zk' in tags: cefr = "A2" # Zhongkao
        elif 'gk' in tags: cefr = "B1" # Gaokao
        elif 'cet4' in tags: cefr = "B1"
        elif 'cet6' in tags: cefr = "B2"
        elif 'ky' in tags: cefr = "C1" # Kaoyan
        elif 'toefl' in tags or 'ielts' in tags: cefr = "C1"
        elif 'gre' in tags: cefr = "C2"
        
        # Calculate MixRead Score (0-100)
        mrs_score = calculate_mrs(rank, cefr)
        
        # Clean translation (extract Chinese)
        chinese = extract_chinese(entry['translation'])
        
        core_library[word] = {
            "pos": entry['pos'],
            "cefr": cefr, # Legacy compatibility
            "level": cefr, 
            "mrs": mrs_score,
            "rank": rank,
            "chn": chinese, # Chinese translation
            "def": entry['definition'].replace('\\n', ' '), # English definition
            "ph": entry['phonetic'],
            "tags": tags
        }

    # 6. Save JSON
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(core_library, f, ensure_ascii=False, indent=0)
    print(f"💾 Saved Core Library to {OUTPUT_JSON} ({os.path.getsize(OUTPUT_JSON)/1024/1024:.1f} MB)")

    # 7. Update SQLite Database for Tier 2 (Full Dictionary)
    print("\ncsv -> sqlite3: Building Tier 2 Database...")
    conn = sqlite3.connect(OUTPUT_DB)
    c = conn.cursor()
    
    # Create table if not exists
    c.execute('''CREATE TABLE IF NOT EXISTS dictionary (
                    word TEXT PRIMARY KEY,
                    ranking INTEGER,
                    translation TEXT,
                    definition TEXT,
                    phonetic TEXT,
                    tag TEXT
                )''')
    
    # Insert/Update all words
    count = 0
    batch = []
    
    # Use full list (including non-ranked)
    for i, w in enumerate(all_words):
        batch.append((
            w['word'], 
            w['rank_score'] if w['rank_score'] < 9999999 else 0,
            w['translation'],
            w['definition'],
            w['phonetic'],
            w['tag']
        ))
        
        if len(batch) >= 10000:
            c.executemany('INSERT OR REPLACE INTO dictionary VALUES (?,?,?,?,?,?)', batch)
            conn.commit()
            batch = []
            count += 10000
            print(f"   Imported {count:,} words...", end='\r')
            
    if batch:
        c.executemany('INSERT OR REPLACE INTO dictionary VALUES (?,?,?,?,?,?)', batch)
        conn.commit()
        
    print(f"\n✅ Full Dictionary Imported: {len(all_words):,} words into {OUTPUT_DB}")
    conn.close()

def calculate_mrs(rank, cefr):
    """
    Calculate MixRead Score (0-100+) based on rank
    Logarithmic scale:
    Rank 1-1000 -> 0-20 (A1)
    Rank 1000-3000 -> 20-40 (A2)
    Rank 3000-6000 -> 40-60 (B1)
    Rank 6000-10000 -> 60-80 (B2)
    Rank 10000-15000 -> 80-100 (C1)
    Rank 15000+ -> 100+ (C2)
    """
    if rank <= 1000:
        return int((rank / 1000) * 20)
    elif rank <= 3000:
        return 20 + int(((rank - 1000) / 2000) * 20)
    elif rank <= 6000:
        return 40 + int(((rank - 3000) / 3000) * 20)
    elif rank <= 10000:
        return 60 + int(((rank - 6000) / 4000) * 20)
    elif rank <= 15000:
        return 80 + int(((rank - 10000) / 5000) * 20)
    else:
        # 15000+
        base = 100
        extra = int((rank - 15000) / 1000)
        return min(120, base + extra)

def extract_chinese(translation):
    if not translation: return ""
    # ECDICT translation format: "n. 书\nvt. 预订"
    # Take the first line and remove POS tag
    first_line = translation.split('\\n')[0]
    parts = first_line.split('.')
    if len(parts) > 1:
        return parts[-1].strip()
    return first_line.strip()

if __name__ == "__main__":
    download_and_process()
