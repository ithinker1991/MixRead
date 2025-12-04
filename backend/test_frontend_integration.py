#!/usr/bin/env python3
"""
Frontend-Backend Integration Test

Tests that mimic exactly what the frontend JavaScript would do.
This catches API contract mismatches between frontend and backend.
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000"
USER_ID = "test_user_integration"

def print_status(message, status="INFO"):
    colors = {
        "OK": '\033[92m',      # Green
        "FAIL": '\033[91m',    # Red
        "INFO": '\033[94m',    # Blue
        "WARNING": '\033[93m'  # Yellow
    }
    reset = '\033[0m'
    print(f"{colors.get(status, '')}{message}{reset}")

def test_frontend_session_creation():
    """Test session creation exactly as frontend does"""
    print_status("\n=== Testing Frontend Session Creation ===", "INFO")

    # Exactly what frontend sends (JSON body)
    response = requests.post(
        f"{BASE_URL}/users/{USER_ID}/review/session",
        headers={'Content-Type': 'application/json'},
        json={'session_type': 'mixed'}
    )

    if response.status_code != 200:
        print_status(f"❌ Failed: HTTP {response.status_code}", "FAIL")
        print_status(f"Response: {response.text}", "FAIL")
        return None

    data = response.json()

    # Check frontend expectations
    if not data.get('success'):
        print_status(f"❌ Failed: {data.get('error')}", "FAIL")
        return None

    if 'session_id' not in data:
        print_status("❌ Missing session_id in response", "FAIL")
        print_status(f"Response keys: {list(data.keys())}", "WARNING")
        return None

    print_status(f"✅ Session created: {data['session_id']}")
    print_status(f"✅ Total cards: {data.get('total_cards', 'N/A')}")

    return data

def test_frontend_answer_submission_wrong():
    """Test answer submission with WRONG format (what frontend was doing)"""
    print_status("\n=== Testing Answer Submission (WRONG FORMAT) ===", "INFO")

    # First create a session
    session_data = test_frontend_session_creation()
    if not session_data:
        return False

    # Test the WRONG format (JSON body) - what frontend was doing
    response = requests.post(
        f"{BASE_URL}/users/{USER_ID}/review/answer",
        headers={'Content-Type': 'application/json'},
        json={
            'session_id': session_data['session_id'],
            'quality': 3
        }
    )

    if response.status_code == 422:
        print_status("❌ Wrong format rejected (422) - this was the bug!", "FAIL")
        print_status("Response: " + response.text, "WARNING")
        return False
    else:
        print_status(f"✅ Wrong format accepted (HTTP {response.status_code}) - unexpected", "OK")
        return True

def test_frontend_answer_submission_correct():
    """Test answer submission with CORRECT format"""
    print_status("\n=== Testing Answer Submission (CORRECT FORMAT) ===", "INFO")

    # First create a session
    session_data = test_frontend_session_creation()
    if not session_data:
        return False

    # Test the CORRECT format (query params)
    response = requests.post(
        f"{BASE_URL}/users/{USER_ID}/review/answer?session_id={session_data['session_id']}&quality=3",
        headers={'Content-Type': 'application/json'}
    )

    if response.status_code != 200:
        print_status(f"❌ Failed: HTTP {response.status_code}", "FAIL")
        print_status("Response: " + response.text, "WARNING")
        return False

    data = response.json()
    if not data.get('success'):
        print_status(f"❌ Failed: {data.get('error')}", "FAIL")
        return False

    print_status("✅ Answer submitted successfully")
    print_status(f"✅ Session complete: {data.get('session_complete', False)}")

    return True

def test_all_quality_scores():
    """Test all quality scores (1-4) as frontend would use"""
    print_status("\n=== Testing All Quality Scores ===", "INFO")

    session_data = test_frontend_session_creation()
    if not session_data:
        return False

    session_id = session_data['session_id']

    # Test each quality score
    for quality in [1, 2, 3, 4]:
        response = requests.post(
            f"{BASE_URL}/users/{USER_ID}/review/answer?session_id={session_id}&quality={quality}",
            headers={'Content-Type': 'application/json'}
        )

        if response.status_code != 200:
            print_status(f"❌ Quality {quality} failed: HTTP {response.status_code}", "FAIL")
            return False

        data = response.json()
        if not data.get('success'):
            print_status(f"❌ Quality {quality} failed: {data.get('error')}", "FAIL")
            return False

        print_status(f"✅ Quality {quality}: OK")

        # Check if session is complete
        if data.get('session_complete'):
            print_status("✅ Session completed after all cards", "OK")
            break

    return True

def main():
    print("=" * 60)
    print("🧪 Frontend-Backend Integration Test")
    print("=" * 60)
    print(f"Testing with user: {USER_ID}")
    print(f"Backend URL: {BASE_URL}")

    # Check if backend is running
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print_status("❌ Backend not responding", "FAIL")
            sys.exit(1)
    except:
        print_status("❌ Cannot connect to backend", "FAIL")
        print_status("Please run: cd backend && python main.py", "INFO")
        sys.exit(1)

    print_status("✅ Backend is running", "OK")

    # Run tests
    results = []

    # Test 1: Session creation
    session_result = test_frontend_session_creation()
    results.append(("Session Creation", session_result is not None))

    # Test 2: Wrong answer format (to confirm the bug)
    wrong_result = test_frontend_answer_submission_wrong()
    results.append(("Wrong Format (Expected to Fail)", not wrong_result))

    # Test 3: Correct answer format
    correct_result = test_frontend_answer_submission_correct()
    results.append(("Correct Format", correct_result))

    # Test 4: All quality scores
    all_scores_result = test_all_quality_scores()
    results.append(("All Quality Scores", all_scores_result))

    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)

    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:30} {status}")
        if result:
            passed += 1

    print("\n" + "-" * 60)
    print(f"Total: {passed}/{len(results)} tests passed")

    if passed == len(results):
        print_status("\n🎉 All tests passed! Frontend-Backend integration is working.", "OK")
        return 0
    else:
        print_status("\n⚠️  Some tests failed. Check the output above.", "WARNING")
        return 1

if __name__ == "__main__":
    sys.exit(main())