#!/usr/bin/env python3
"""
Parse CC-CEDICT and extract English translations for words
CC-CEDICT Format: Traditional Simplified [pin1 yin1] /definition 1/definition 2/
"""

import re
import json
from collections import defaultdict

def parse_cedict(filepath='cedict_ts.u8'):
    """
    Parse CC-CEDICT file and extract English definitions
    Returns mapping of English words to Chinese and English definitions
    """
    cedict_data = {}
    count = 0

    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()

            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue

            # Parse CEDICT format: Traditional Simplified [pin1 yin1] /definition 1/definition 2/
            # Example: 中國 中国 [zhong1 guo2] /China/Middle Kingdom/
            match = re.match(r'(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/$', line)
            if not match:
                continue

            traditional, simplified, pinyin, definitions = match.groups()

            # Parse definitions - first one is primary
            defs = [d.strip() for d in definitions.split('/') if d.strip()]
            if not defs:
                continue

            primary_def = defs[0]

            # Extract English words from the definition
            # For now, just store the whole definition
            cedict_data[simplified.lower()] = {
                'traditional': traditional,
                'simplified': simplified,
                'pinyin': pinyin,
                'definition': primary_def,
                'all_definitions': defs
            }

            count += 1

    print(f"Loaded {count} entries from CC-CEDICT")
    return cedict_data

def extract_english_words_from_definition(definition):
    """
    Extract English words from a definition string
    Simple approach: split by space and filter
    """
    # Remove parentheses and common markers
    definition = re.sub(r'\([^)]*\)', '', definition)
    definition = re.sub(r'\[[^\]]*\]', '', definition)

    # Split and get individual words
    words = re.findall(r'[a-zA-Z]+', definition)
    return words

def add_translations_to_vocabulary(vocab_file='data/cefr_words_expanded.json',
                                   output_file='data/cefr_words_with_translations.json'):
    """
    Add English and Chinese translations to vocabulary
    """
    # Load expanded vocabulary
    with open(vocab_file, 'r', encoding='utf-8') as f:
        vocab = json.load(f)

    # Parse CC-CEDICT
    cedict = parse_cedict('cedict_ts.u8')

    # Try to match words and add translations
    added = 0
    not_found = 0

    print(f"\nMatching {len(vocab)} vocabulary words with CC-CEDICT...")

    for word, word_data in vocab.items():
        # If already has Chinese translation, skip
        if word_data.get('chinese'):
            continue

        # Try exact match first
        if word in cedict:
            word_data['chinese'] = cedict[word]['simplified']
            word_data['chinese_trad'] = cedict[word]['traditional']
            added += 1
        else:
            not_found += 1

    print(f"\n✓ Added translations: {added} words")
    print(f"✗ Not found in CC-CEDICT: {not_found} words")

    # Save updated vocabulary
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)

    print(f"\n✓ Saved to {output_file}")

    return vocab

def analyze_translations(vocab):
    """Analyze translation coverage"""
    total = len(vocab)
    with_translation = sum(1 for v in vocab.values() if v.get('chinese'))
    coverage = (with_translation / total * 100) if total > 0 else 0

    print(f"\nTranslation Coverage:")
    print(f"  Total words: {total}")
    print(f"  With translation: {with_translation}")
    print(f"  Coverage: {coverage:.1f}%")

    # Show CEFR distribution with translations
    print(f"\nCEFR Distribution (with translations):")
    cefr_dist = defaultdict(int)
    cefr_translated = defaultdict(int)

    for word_data in vocab.values():
        cefr = word_data.get('cefr_level', 'Unknown')
        cefr_dist[cefr] += 1
        if word_data.get('chinese'):
            cefr_translated[cefr] += 1

    for level in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Unknown']:
        total_at_level = cefr_dist.get(level, 0)
        translated_at_level = cefr_translated.get(level, 0)
        pct = (translated_at_level / total_at_level * 100) if total_at_level > 0 else 0
        print(f"  {level:8s}: {translated_at_level:5d}/{total_at_level:5d} ({pct:5.1f}%)")

def main():
    print("=" * 60)
    print("Add Chinese Translations to Vocabulary")
    print("=" * 60)

    vocab = add_translations_to_vocabulary()
    analyze_translations(vocab)

    print("\n" + "=" * 60)
    print("DONE")
    print("=" * 60)

if __name__ == '__main__':
    main()
