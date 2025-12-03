#!/usr/bin/env python3
"""
Test the improved sentence extraction functionality
"""

import requests
import json

# Test adding words with the improved extraction
test_user = "test_improved_extraction"
test_url = "http://localhost:8000"
test_words = ["comprehensive", "feature", "understanding"]

# Clear any existing data for this test user
print(f"Clearing existing data for test user: {test_user}")
response = requests.delete(f"{test_url}/users/{test_user}")
print(f"Delete status: {response.status_code}")

# Test words with detailed context
test_contexts = [
    {
        "page_url": "https://example.com/test-page-1",
        "page_title": "Test Page with Proper Sentences",
        "sentences": [
            "This is a comprehensive test of the improved sentence extraction functionality.",
            "The system should now properly extract full sentences instead of fragments.",
            "Understanding the context is crucial for effective language learning."
        ]
    },
    {
        "page_url": "https://example.com/test-page-2",
        "page_title": "Another Test Page",
        "sentences": [
            "The main feature of this update is improved sentence handling.",
            "Previous versions had issues with extracting complete sentences from text.",
            "Now we should see proper sentences in the library instead of single words."
        ]
    }
]

print("\nTesting improved sentence extraction...")
print("-" * 50)

# Add words with proper sentences
for word in test_words:
    payload = {
        "words": [word],
        "contexts": test_contexts
    }

    print(f"\nAdding word: {word}")
    response = requests.post(
        f"{test_url}/users/{test_user}/library",
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Success: {data.get('success')}")
        print(f"Message: {data.get('message')}")
    else:
        print(f"Error: {response.text}")

# Verify the results
print("\n" + "=" * 60)
print("Verifying saved sentences...")
print("=" * 60)

response = requests.get(f"{test_url}/users/{test_user}/library")
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        library = data.get("library", [])
        print(f"Library has {len(library)} words:\n")

        for word_data in library:
            word = word_data["word"]
            print(f"\n=== Word: {word} ===")

            contexts = word_data.get('contexts', [])
            for i, context in enumerate(contexts, 1):
                print(f"\nContext {i} - {context.get('page_title')}:")
                sentences = context.get('sentences', [])

                print(f"  Sentences ({len(sentences)}):")
                for j, sentence in enumerate(sentences, 1):
                    print(f"    {j}. \"{sentence}\"")

                    # Check quality
                    if len(sentence) < 20:
                        print(f"       ⚠️  Very short sentence")
                    if sentence.count(' ') < 3:
                        print(f"       ⚠️  Very few words")
                    if '.' not in sentence and '!' not in sentence and '?' not in sentence:
                        print(f"       ⚠️  Missing sentence punctuation")
                    if sentence.startswith(word) and len(sentence) < 30:
                        print(f"       ⚠️  Appears to be fallback text")
else:
    print(f"Failed to verify: {response.status_code}")

print("\n" + "=" * 60)
print("Test completed!")
print("Now test with the actual Chrome extension to see if sentences are extracted properly.")