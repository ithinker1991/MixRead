"""
Test script for MixRead backend API
Verify all endpoints work correctly
"""

import httpx
import json
import sys

BASE_URL = "http://localhost:8000"

def test_health():
    print("Testing /health endpoint...")
    response = httpx.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["words_loaded"] > 0
    print(f"✓ Health check passed. Loaded {data['words_loaded']} words")

def test_get_word():
    print("\nTesting GET /word/{word} endpoint...")

    # Test with valid word
    response = httpx.get(f"{BASE_URL}/word/beautiful")
    assert response.status_code == 200
    data = response.json()
    assert data["word"] == "beautiful"
    assert data["found"] == True
    assert "cefr_level" in data
    assert "definition" in data
    print(f"✓ Word lookup works. 'beautiful' = {data['cefr_level']}")

    # Test with unknown word
    response = httpx.get(f"{BASE_URL}/word/xyzabc123")
    assert response.status_code == 200
    data = response.json()
    assert data["found"] == False
    print("✓ Unknown word handled correctly")

def test_highlight_words():
    print("\nTesting POST /highlight-words endpoint...")

    response = httpx.post(
        f"{BASE_URL}/highlight-words",
        json={
            "words": ["the", "beautiful", "extraordinary", "language", "hello"],
            "difficulty_level": "B1"
        }
    )
    assert response.status_code == 200
    data = response.json()

    assert data["difficulty_level"] == "B1"
    assert data["total_words"] == 5
    assert "highlighted_words" in data
    assert "word_details" in data

    print(f"✓ Highlight words works. {data['highlighted_count']}/{data['total_words']} words highlighted at B1")
    print(f"  Highlighted: {data['highlighted_words']}")

def test_difficulty_levels():
    print("\nTesting different difficulty levels...")

    test_words = ["the", "hello", "language", "extraordinary", "comprehensive"]

    for level in ["A1", "A2", "B1", "B2", "C1", "C2"]:
        response = httpx.post(
            f"{BASE_URL}/highlight-words",
            json={
                "words": test_words,
                "difficulty_level": level
            }
        )
        data = response.json()
        print(f"  {level}: {data['highlighted_count']}/{data['total_words']} words highlighted")

def test_batch_word_info():
    print("\nTesting POST /batch-word-info endpoint...")

    response = httpx.post(
        f"{BASE_URL}/batch-word-info",
        json={
            "words": ["beautiful", "extraordinary", "simple"],
            "difficulty_level": "B1"
        }
    )
    assert response.status_code == 200
    data = response.json()

    assert "words" in data
    assert len(data["words"]) == 3

    for word_info in data["words"]:
        assert "word" in word_info
        assert "definition" in word_info
        print(f"✓ {word_info['word']}: {word_info.get('cefr_level', 'N/A')} - {word_info['definition'][:50]}...")

def main():
    print("=" * 60)
    print("MixRead Backend API Test Suite")
    print("=" * 60)

    try:
        test_health()
        test_get_word()
        test_highlight_words()
        test_difficulty_levels()
        test_batch_word_info()

        print("\n" + "=" * 60)
        print("✅ All tests passed!")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
