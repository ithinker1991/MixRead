import requests
import json

# Test adding a word to library with sentence context
test_user = "test_sentence_123"
test_word = "comprehensive"
test_url = "http://localhost:8000"

# Test API endpoints
print("Testing sentence extraction...")
print("-" * 50)

# 1. Check current library
response = requests.get(f"{test_url}/users/{test_user}/library")
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        print(f"Current library for {test_user}: {len(data.get('library', []))} words")
    else:
        print("No library data or error")
else:
    print(f"Failed to get library: {response.status_code}")

print("\n" + "-" * 50)
print("Testing add to library with sentences...")

# 2. Add word with multiple sentence contexts
contexts = [
    {
        "page_url": "https://example.com/test-page",
        "page_title": "Test Article About Learning",
        "sentences": [
            "This is a comprehensive test of the MixRead extension with multiple sentences.",
            "The system should highlight difficult words based on your proficiency level.",
            "Understanding context is crucial for effective language acquisition."
        ]
    }
]

payload = {
    "words": [test_word],
    "contexts": contexts
}

response = requests.post(
    f"{test_url}/users/{test_user}/library",
    json=payload,
    headers={"Content-Type": "application/json"}
)

print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")

if response.status_code == 200:
    data = response.json()
    print(f"Success: {data.get('success')}")
    print(f"Message: {data.get('message')}")

print("\n" + "-" * 50)
print("Verifying saved data...")

# 3. Verify the saved data
response = requests.get(f"{test_url}/users/{test_user}/library")
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        library = data.get("library", [])
        print(f"Library now has {len(library)} words")

        # Find our test word
        for word_data in library:
            if word_data["word"] == test_word:
                print(f"\nWord: {word_data['word']}")
                print(f"Status: {word_data.get('status')}")
                print(f"Added at: {word_data.get('added_at')}")
                print(f"Contexts count: {len(word_data.get('contexts', []))}")

                # Show each context
                for i, context in enumerate(word_data.get('contexts', []), 1):
                    print(f"\n  Context {i}:")
                    print(f"    Page URL: {context.get('page_url')}")
                    print(f"    Page Title: {context.get('page_title')}")
                    print(f"    Sentences: {context.get('sentences', [])}")

                    # Check sentence quality
                    sentences = context.get('sentences', [])
                    if sentences:
                        for j, sentence in enumerate(sentences, 1):
                            print(f"      Sentence {j}: '{sentence}'")
                            # Check for issues
                            if '1x' in sentence or '×' in sentence:
                                print(f"      ⚠️  WARNING: Contains '1x' or special chars")
                            if len(sentence) < 20:
                                print(f"      ⚠️  WARNING: Very short sentence")
                            if sentence.count(' ') < 3:
                                print(f"      ⚠️  WARNING: Few words")
                    else:
                        print(f"      No sentences found!")
            else:
                print(f"\nTest word '{test_word}' not found in library")
else:
    print(f"Failed to verify: {response.status_code}")