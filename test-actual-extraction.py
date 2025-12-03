#!/usr/bin/env python3
"""
Test script to verify what sentences are actually being saved
when using the MixRead extension
"""

import requests
import json
import time

def check_library_content(user_id):
    """Check what's actually in a user's library"""
    test_url = "http://localhost:8000"

    print(f"Checking library for user: {user_id}")
    print("=" * 60)

    response = requests.get(f"{test_url}/users/{user_id}/library")

    if response.status_code == 200:
        data = response.json()
        if data.get("success"):
            library = data.get("library", [])
            print(f"Library contains {len(library)} words")

            if not library:
                print("Library is empty!")
                return

            for i, word_data in enumerate(library, 1):
                print(f"\n--- Word {i}: {word_data['word']} ---")
                print(f"Status: {word_data.get('status')}")
                print(f"Added: {word_data.get('added_at')}")

                contexts = word_data.get('contexts', [])
                print(f"Contexts: {len(contexts)}")

                for j, context in enumerate(contexts, 1):
                    print(f"\n  Context {j}:")
                    print(f"    URL: {context.get('page_url', 'N/A')}")
                    print(f"    Title: {context.get('page_title', 'N/A')}")

                    sentences = context.get('sentences', [])
                    print(f"    Sentences: {len(sentences)}")

                    for k, sentence in enumerate(sentences, 1):
                        print(f"      {k}. \"{sentence}\"")

                        # Check for issues
                        if '1x' in sentence or '×' in sentence:
                            print(f"         ⚠️  Contains special characters!")
                        if len(sentence) < 20:
                            print(f"         ⚠️  Very short ({len(sentence)} chars)")
                        if sentence.count(' ') < 3:
                            print(f"         ⚠️  Very few words")

        else:
            print(f"Error: {data.get('error')}")
    else:
        print(f"Failed to fetch library: {response.status_code}")

def list_all_users():
    """List all users in the system"""
    test_url = "http://localhost:8000"

    # Get all users by checking the database
    print("Checking for active users...")

    # Try a few common test user IDs
    test_users = [
        "user_1764608846468_fe2v088uq",  # User mentioned in conversation
        "test_sentence_123",              # Our test user
        "user_default",                   # Default user
    ]

    for user_id in test_users:
        response = requests.get(f"{test_url}/users/{user_id}/library")
        if response.status_code == 200:
            data = response.json()
            if data.get("success") and data.get("library"):
                print(f"✓ Found data for user: {user_id}")
                check_library_content(user_id)
                print("\n" + "=" * 80 + "\n")

if __name__ == "__main__":
    print("MixRead Library Content Inspector")
    print("=" * 80)

    # Check specific user if provided
    import sys
    if len(sys.argv) > 1:
        user_id = sys.argv[1]
        check_library_content(user_id)
    else:
        # Check all test users
        list_all_users()

        # Also check for the user that was mentioned
        print("\nChecking specific user mentioned in conversation...")
        check_library_content("user_1764608846468_fe2v088uq")