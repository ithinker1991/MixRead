import asyncio
import os
import sys

# Add backend directory to path
sys.path.append(os.path.abspath("backend"))

from infrastructure.dictionary import DictionaryService


async def verify_problematic_words():
    service = DictionaryService()
    
    # Words reported by user + base forms
    test_words = [
        "are", "be", 
        "done", "do", 
        "writing", "write", 
        "using", "use", 
        "larger", "large"
    ]
    
    print(f"\n{'Word':<12} | {'Found':<5} | {'Source':<6} | {'Level':<5} | {'MRS':<5} | {'Rank':<5}")
    print("-" * 65)
    
    for word in test_words:
        info = service.lookup(word)
        mrs = info.get("mrs")
        level = info.get("level")
        rank = info.get("rank")
        source = info.get("source", "N/A")
        found = info.get("found")
        
        # Simulate logic in HighlightApplicationService
        effective_mrs = mrs if mrs is not None else (100 if found else "N/A")
        
        print(f"{word:<12} | {str(found):<5} | {source:<6} | {str(level):<5} | {str(mrs):<5} | {str(rank):<5} -> Effective MRS: {effective_mrs}")

if __name__ == "__main__":
    asyncio.run(verify_problematic_words())
