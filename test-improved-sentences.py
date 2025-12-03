#!/usr/bin/env python3
"""
Test the improved sentence extraction by adding words that had problems
"""

import requests
import json

# Clear the problematic user's data and test with clean sentences
test_user = "user_1764608846468_fe2v088uq"
test_url = "http://localhost:8000"

# Test words with clean, proper sentences
test_words = [
    {
        "word": "slack",
        "contexts": [
            {
                "page_url": "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents",
                "page_title": "Effective harnesses for long-running agents",
                "sentences": [
                    "The team uses Slack for communication and coordination.",
                    "Please don't let the project slack behind schedule.",
                    "She picked up the slack when her colleague was sick."
                ]
            }
        ]
    },
    {
        "word": "proper",
        "contexts": [
            {
                "page_url": "https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents",
                "page_title": "Effective harnesses for long-running agents",
                "sentences": [
                    "It's important to use proper techniques for software development.",
                    "The proper documentation helps maintain code quality.",
                    "She demonstrated proper form during the exercise."
                ]
            }
        ]
    }
]

print("Testing improved sentence extraction...")
print("=" * 60)

# Add test words with proper sentences
for word_data in test_words:
    word = word_data["word"]
    contexts = word_data["contexts"]

    payload = {
        "words": [word],
        "contexts": contexts
    }

    print(f"\nAdding word with clean sentences: {word}")
    response = requests.post(
        f"{test_url}/users/{test_user}/library",
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    if response.status_code == 200:
        data = response.json()
        print(f"✓ Successfully added '{word}'")
    else:
        print(f"✗ Failed to add '{word}': {response.text}")

# Check the results
print("\n" + "=" * 60)
print("Checking improved results...")
print("=" * 60)

response = requests.get(f"{test_url}/users/{test_user}/library")
if response.status_code == 200:
    data = response.json()
    if data.get("success"):
        library = data.get("library", [])

        # Find slack and proper
        for word_data in library:
            word = word_data["word"]
            if word in ["slack", "proper"]:
                print(f"\n📚 Word: {word}")
                contexts = word_data.get('contexts', [])

                for i, context in enumerate(contexts, 1):
                    sentences = context.get('sentences', [])
                    print(f"  Context {i}: {len(sentences)} sentences")

                    for j, sentence in enumerate(sentences, 1):
                        print(f"    {j}. \"{sentence}\"")

                        # Quality checks
                        if sentence.count(' ') < 3:
                            print(f"       ⚠️  Too short")
                        if '×' in sentence or '[' in sentence:
                            print(f"       ⚠️  Contains bad characters")
                        if sentence.startswith(word) and len(sentence) < 50:
                            print(f"       ⚠️  Might be fallback")

print(f"\n🎯 Test completed!")
print(f"View improved library at: http://localhost:8000/library-viewer.html?user={test_user}")
print("\nNow test the Chrome extension on a real page to see if sentence extraction works better.")