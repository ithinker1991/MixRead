#!/usr/bin/env python3
"""
Vocabulary Expansion Script
Merges CEFR-J data with existing word library and adds Chinese translations
"""

import json
import csv
import sys
from collections import defaultdict
from pathlib import Path

def load_existing_words():
    """Load existing CEFR words from database"""
    with open('data/cefr_words.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def load_chinese_dict():
    """Load existing Chinese translations"""
    with open('chinese_dict.json', 'r', encoding='utf-8') as f:
        return json.load(f)

def load_cefrj_csv(filepath):
    """Load CEFR-J CSV data"""
    words = {}
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            headword = row['headword'].lower().strip()
            pos = row['pos'].lower().strip() if row.get('pos') else 'unknown'
            cefr = row['CEFR'].strip() if row.get('CEFR') else 'Unknown'

            # Skip entries without CEFR level
            if not cefr or cefr == 'Unknown':
                continue

            # Skip if already have this word with same CEFR
            if headword in words:
                # Keep the entry (avoid duplicates within CSV)
                continue

            words[headword] = {
                'pos': pos,
                'cefr_level': cefr,
                'source': Path(filepath).stem
            }

    return words

def merge_vocabularies(existing, cefrj_a1b2, cefrj_c1c2, chinese_dict):
    """
    Merge vocabularies, preferring existing entries for consistency
    """
    merged = {}
    stats = {
        'existing_words': 0,
        'new_words': 0,
        'updated_words': 0,
        'words_with_translation': 0,
    }

    # Start with existing words
    for word, data in existing.items():
        merged[word] = data.copy()
        stats['existing_words'] += 1

    # Add CEFR-J A1-B2 words
    for word, data in cefrj_a1b2.items():
        if word not in merged:
            merged[word] = {
                'pos': data['pos'],
                'cefr_level': data['cefr_level'],
                'chinese': chinese_dict.get(word, '')
            }
            stats['new_words'] += 1
        else:
            # Update CEFR level if different or add pos if missing
            if 'cefr_level' not in merged[word]:
                merged[word]['cefr_level'] = data['cefr_level']
            if merged[word].get('pos') == 'unknown' or not merged[word].get('pos'):
                merged[word]['pos'] = data['pos']

    # Add CEFR-J C1-C2 words
    for word, data in cefrj_c1c2.items():
        if word not in merged:
            merged[word] = {
                'pos': data['pos'],
                'cefr_level': data['cefr_level'],
                'chinese': chinese_dict.get(word, '')
            }
            stats['new_words'] += 1

    # Ensure all words have Chinese translations from dict
    for word in merged:
        if not merged[word].get('chinese') and word in chinese_dict:
            merged[word]['chinese'] = chinese_dict[word]
            stats['words_with_translation'] += 1

    return merged, stats

def analyze_cefr_distribution(words):
    """Analyze CEFR level distribution"""
    distribution = defaultdict(int)
    for word_data in words.values():
        cefr = word_data.get('cefr_level', 'Unknown')
        distribution[cefr] += 1

    return dict(sorted(distribution.items()))

def save_expanded_vocabulary(words, output_path='data/cefr_words_expanded.json'):
    """Save expanded vocabulary to JSON"""
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(words, f, ensure_ascii=False, indent=2)
    print(f"✓ Saved {len(words)} words to {output_path}")

def main():
    print("=" * 60)
    print("MixRead Vocabulary Expansion")
    print("=" * 60)

    # Load existing data
    print("\n1. Loading existing vocabulary...")
    existing = load_existing_words()
    chinese_dict = load_chinese_dict()
    print(f"   ✓ Loaded {len(existing)} existing words")
    print(f"   ✓ Loaded {len(chinese_dict)} Chinese translations")

    # Load CEFR-J data
    print("\n2. Loading CEFR-J vocabulary profiles...")
    cefrj_a1b2 = load_cefrj_csv('cefrj-raw.csv')
    cefrj_c1c2 = load_cefrj_csv('cefrj-c1c2.csv')
    print(f"   ✓ Loaded {len(cefrj_a1b2)} words from CEFR-J A1-B2")
    print(f"   ✓ Loaded {len(cefrj_c1c2)} words from CEFR-J C1-C2")

    # Merge vocabularies
    print("\n3. Merging vocabularies...")
    merged, stats = merge_vocabularies(existing, cefrj_a1b2, cefrj_c1c2, chinese_dict)
    print(f"   ✓ Total words after merge: {len(merged)}")
    print(f"   ✓ Existing words kept: {stats['existing_words']}")
    print(f"   ✓ New words added: {stats['new_words']}")
    print(f"   ✓ Words with Chinese translation: {stats['words_with_translation']}")

    # Analyze distribution
    print("\n4. CEFR Level Distribution:")
    distribution = analyze_cefr_distribution(merged)
    total = sum(distribution.values())
    for level in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Unknown']:
        count = distribution.get(level, 0)
        pct = (count / total * 100) if total > 0 else 0
        bar = "█" * int(pct / 2)
        print(f"   {level:8s}: {count:5d} ({pct:5.1f}%) {bar}")

    # Save expanded vocabulary
    print("\n5. Saving expanded vocabulary...")
    save_expanded_vocabulary(merged)

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Previous vocabulary size: 6,991 words")
    print(f"CEFR-J new words available: {len(cefrj_a1b2) + len(cefrj_c1c2)}")
    print(f"Current vocabulary size: {len(existing)} words")
    print(f"Expanded vocabulary size: {len(merged)} words")
    print(f"Growth: +{len(merged) - len(existing)} words (+{(len(merged) - len(existing)) / len(existing) * 100:.1f}%)")
    print(f"Target: 18,000+ words")
    print(f"Progress: {len(merged) / 18000 * 100:.1f}% of target")
    print("\nNext step: Add Chinese translations for new words")
    print("=" * 60)

if __name__ == '__main__':
    main()
