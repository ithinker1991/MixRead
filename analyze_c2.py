import asyncio
import json
import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath("backend"))

from infrastructure.dictionary import DictionaryService


async def analyze_words():
    print("Initializing DictionaryService...")
    service = DictionaryService()
    
    words_to_check = ["other", "taking", "yelling", "moving"]
    
    print(f"\n{'Word':<10} | {'Found':<5} | {'Source':<6} | {'Level':<5} | {'MRS':<5} | {'Base Form (Lemma)'}")
    print("-" * 80)
    
    for word in words_to_check:
        # 1. Direct Lookup (Simulating API)
        info = service.lookup(word)
        
        # 2. Debugging Internal Logic
        word_lower = word.lower()
        in_core = word_lower in service.cefr_data
        
        lemma_debug = "N/A"
        try:
            from lemminflect import getLemma
            lemmas_verb = getLemma(word_lower, upos="VERB")
            lemmas_noun = getLemma(word_lower, upos="NOUN")
            lemmas_adj = getLemma(word_lower, upos="ADJ")
            lemma_debug = f"V:{lemmas_verb} N:{lemmas_noun} A:{lemmas_adj}"
        except ImportError:
            lemma_debug = "Lib Missing"
        
        mrs = info.get("mrs")
        source = info.get("source", "N/A")
        
        print(f"{word:<10} | {str(info.get('found', False)):<5} | {source:<6} | {str(info.get('level')): <5} | {str(mrs):<5} | {lemma_debug}")
        
        if not in_core and source == "full":
             print(f"  -> Not in Core. Fallback to Full Dictionary (Tier 2). Defaulting to MRS 100/C2?")

if __name__ == "__main__":
    asyncio.run(analyze_words())
