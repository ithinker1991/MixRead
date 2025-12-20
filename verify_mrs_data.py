import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath("backend"))

from infrastructure.dictionary import DictionaryService


async def verify_mrs_data():
    print("Initializing DictionaryService...")
    # DictionaryService is a singleton and initializes in __new__, no async initialize method
    service = DictionaryService()
    
    test_words = ["apple", "run", "hypothesis", "serendipity", "the", "create"]
    
    print("\nChecking MRS scores for test words:")
    print("-" * 65)
    print(f"{'Word':<12} | {'Level':<5} | {'MRS':<5} | {'Found':<5} | {'Source':<6}")
    print("-" * 65)
    
    for word in test_words:
        # lookup is synchronous
        info = service.lookup(word)
        mrs = info.get("mrs")
        level = info.get("level")
        source = info.get("source", "N/A")
        print(f"{word:<12} | {str(level):<5} | {str(mrs):<5} | {str(info['found']):<5} | {source:<6}")

    print("-" * 65)

if __name__ == "__main__":
    asyncio.run(verify_mrs_data())
