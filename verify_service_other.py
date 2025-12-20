
import asyncio
import os
import sys
from unittest.mock import MagicMock

# Add backend directory to path
sys.path.append(os.path.abspath("backend"))

from application.services import HighlightApplicationService
from domain.models import User
from infrastructure.dictionary import DictionaryService


# Mock classes to isolate HighlightLogic
class MockRepo:
    def get_user(self, user_id):
        user = User(user_id)
        user.known_words = {"the", "a"} # basic
        return user

async def verify_service_pipeline():
    print("Initializing Service Pipeline...")
    dict_service = DictionaryService()
    repo = MockRepo()
    service = HighlightApplicationService(repo, dict_service)
    
    test_words = ["other"]
    user_id = "test_user"
    difficulty_level = "A1" # Should highlight A1+
    difficulty_mrs = 0 # Highlight everything
    
    print(f"\nScanning words: {test_words}")
    result = service.get_highlighted_words(user_id, test_words, difficulty_level, difficulty_mrs)
    
    if result["success"]:
        print(f"\nResult Summary:")
        for detail in result["word_details"]:
            print(f"Word: {detail['word']}")
            print(f"  MRS:   {detail['mrs']}")
            print(f"  Level: {detail['cefr_level']}")
            print(f"  Reason:{detail['reason']}")
            
            if detail['mrs'] >= 100:
                print("  -> ERROR: Classified as C2/Hard!")
            else:
                print("  -> Correctly classified as Easy.")
    else:
        print("Service Failed:", result.get("error"))

    # Also check what dictionary service returns directly
    print("\nDirect Dictionary Lookup:")
    info = dict_service.lookup("other")
    print(f"Info: {info}")

if __name__ == "__main__":
    asyncio.run(verify_service_pipeline())
