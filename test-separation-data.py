#!/usr/bin/env python3
"""
Create test data to demonstrate the separated sentences and sources display
"""

import requests
import json

test_user = "test_separation_display"
test_url = "http://localhost:8000"

# Clear any existing data
print(f"Clearing existing data for test user: {test_user}")
response = requests.delete(f"{test_url}/users/{test_user}")

# Create test data with proper sentences
test_words_data = [
    {
        "word": "comprehensive",
        "contexts": [
            {
                "page_url": "https://example.com/article-1",
                "page_title": "Understanding Complex Systems",
                "sentences": [
                    "This comprehensive analysis covers all aspects of modern technology.",
                    "Students need comprehensive knowledge to succeed in this field.",
                    "The comprehensive report was published last month."
                ]
            },
            {
                "page_url": "https://example.com/article-2",
                "page_title": "Advanced Learning Techniques",
                "sentences": [
                    "A comprehensive approach to learning includes practice and theory.",
                    "Her comprehensive understanding of the subject impressed everyone."
                ]
            }
        ]
    },
    {
        "word": "innovation",
        "contexts": [
            {
                "page_url": "https://techblog.com/future",
                "page_title": "The Future of Technology",
                "sentences": [
                    "Innovation drives progress in every industry.",
                    "The latest innovation promises to change how we work.",
                    "Understanding innovation is crucial for business leaders."
                ]
            }
        ]
    },
    {
        "word": "sustainable",
        "contexts": [
            {
                "page_url": "https://greenearth.org/environment",
                "page_title": "Environmental Protection Guide",
                "sentences": [
                    "Sustainable development balances economic and environmental needs.",
                    "We must adopt sustainable practices for future generations."
                ]
            },
            {
                "page_url": "https://ecolife.com/living",
                "page_title": "Sustainable Living Tips",
                "sentences": [
                    "Sustainable living starts with small daily choices.",
                    "The sustainable lifestyle benefits both health and environment."
                ]
            }
        ]
    }
]

print("\nCreating test data with proper sentences and sources...")
print("=" * 60)

# Add each word with its contexts
for word_data in test_words_data:
    word = word_data["word"]
    contexts = word_data["contexts"]

    payload = {
        "words": [word],
        "contexts": contexts
    }

    print(f"\nAdding word: {word}")
    response = requests.post(
        f"{test_url}/users/{test_user}/library",
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    if response.status_code == 200:
        data = response.json()
        print(f"✓ Successfully added '{word}' with {len(contexts)} contexts")
    else:
        print(f"✗ Failed to add '{word}': {response.text}")

# Verify the results
print("\n" + "=" * 60)
print("Verifying the test data...")
print("=" * 60)

response = requests.get(f"{test_url}/users/{test_user}/library")
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        library = data.get("library", [])
        print(f"✓ Library contains {len(library)} words")

        for word_data in library:
            word = word_data["word"]
            contexts = word_data.get('contexts', [])
            print(f"\n📚 '{word}' - {len(contexts)} context(s):")

            total_sentences = 0
            for i, context in enumerate(contexts, 1):
                sentences = context.get('sentences', [])
                total_sentences += len(sentences)
                print(f"  {i}. {context.get('page_title')} ({len(sentences)} sentences)")

            print(f"  Total: {total_sentences} unique sentences")
else:
    print("Failed to verify data")

print(f"\n🎯 Test completed!")
print(f"View the improved library at: http://localhost:8000/library-viewer.html?user={test_user}")
print("\nNew features to check:")
print("✅ Sentences and Sources are now in separate columns")
print("✅ Modal shows all sentences first, then all sources")
print("✅ Better visual separation with improved styling")
print("✅ Sentences show which sources they came from")