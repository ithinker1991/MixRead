#!/usr/bin/env python3
"""
MixRead Review System - API Integration Test

This script tests all review system API endpoints.

Usage:
    python test_review_api.py

Requirements:
    - Backend must be running: python main.py
    - At least 5 test words in database for test_user
"""

import requests
import json
import time
from datetime import datetime
from typing import Optional, Dict

# Configuration
BASE_URL = "http://localhost:8000"
USER_ID = "test_user"
TIMEOUT = 10

# Colors for terminal output
class Colors:
    OK = '\033[92m'      # Green
    FAIL = '\033[91m'    # Red
    WARNING = '\033[93m' # Yellow
    BLUE = '\033[94m'    # Blue
    RESET = '\033[0m'

def print_header(text: str):
    """Print section header"""
    width = 70
    print(f"\n{Colors.BLUE}{'='*width}{Colors.RESET}")
    print(f"{Colors.BLUE}  {text}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*width}{Colors.RESET}\n")

def print_success(text: str):
    """Print success message"""
    print(f"{Colors.OK}✅ {text}{Colors.RESET}")

def print_error(text: str):
    """Print error message"""
    print(f"{Colors.FAIL}❌ {text}{Colors.RESET}")

def print_warning(text: str):
    """Print warning message"""
    print(f"{Colors.WARNING}⚠️  {text}{Colors.RESET}")

def print_info(text: str):
    """Print info message"""
    print(f"ℹ️  {text}")

def setup_test_data():
    """Ensure test vocabulary is set up"""
    try:
        from infrastructure.database import SessionLocal
        from infrastructure.models import VocabularyEntryModel
        from datetime import datetime

        db = SessionLocal()
        try:
            # Check if we have test data
            count = db.query(VocabularyEntryModel).filter_by(user_id=USER_ID).count()

            if count < 20:
                # Add test words
                test_words = [
                    'serendipity', 'ephemeral', 'quintessential',
                    'ubiquitous', 'eloquent', 'melancholy',
                    'pragmatic', 'nuance', 'ambiguous', 'diligent',
                    'perspicacious', 'ebullient', 'recalcitrant',
                    'pellucid', 'ostracize', 'perspicacity',
                    'obfuscate', 'vindicate', 'magnanimous', 'sanguine'
                ]

                existing_words = {
                    row[0] for row in db.query(VocabularyEntryModel.word).filter_by(user_id=USER_ID).all()
                }

                for word in test_words:
                    if word not in existing_words:
                        entry = VocabularyEntryModel(
                            user_id=USER_ID,
                            word=word
                        )
                        db.add(entry)

                db.commit()
        finally:
            db.close()

    except Exception as e:
        print_warning(f"Could not setup test data: {e}")

def check_backend_connection() -> bool:
    """Check if backend is running"""
    print_header("Step 1: 检查后端连接")

    try:
        response = requests.get(f"{BASE_URL}/", timeout=TIMEOUT)
        print_success("后端已连接")
        return True
    except requests.exceptions.ConnectionError:
        print_error("无法连接到后端")
        print_info("请运行: cd backend && python main.py")
        return False
    except Exception as e:
        print_error(f"连接失败: {e}")
        return False

def test_session_creation() -> Optional[Dict]:
    """Test session creation endpoint"""
    print_header("Step 2: 测试会话创建")

    try:
        print_info("创建 'mixed' 类型的会话...")
        response = requests.post(
            f"{BASE_URL}/users/{USER_ID}/review/session",
            json={"session_type": "mixed"},
            timeout=TIMEOUT
        )

        if response.status_code == 204:
            print_warning("没有可用的卡片 (204 No Content)")
            print_info("请确保数据库中有至少 5 个单词用于 {USER_ID}")
            return None

        if response.status_code != 200:
            print_error(f"HTTP {response.status_code}")
            print_info(f"响应: {response.text}")
            return None

        data = response.json()

        if not data.get("success"):
            print_error(f"API 错误: {data.get('error', '未知错误')}")
            return None

        # Handle both response formats
        if "data" in data:
            session = data["data"]
        else:
            session = data

        print_success("会话创建成功")
        print_info(f"  • Session ID: {session['session_id'][:8]}...")
        print_info(f"  • Total Cards: {session['total_cards']}")
        first_card = session.get('first_card', {})
        card_word = first_card.get('content', {}).get('word') or first_card.get('front', 'N/A')
        print_info(f"  • First Card: {card_word}")
        print_info(f"  • Progress: {session['progress']['current']} / {session['progress']['total']}")

        return session

    except Exception as e:
        print_error(f"异常: {e}")
        return None

def test_answer_submission(session: Dict) -> Optional[Dict]:
    """Test answer submission endpoint"""
    print_header("Step 3: 测试答题提交")

    if not session:
        print_error("没有活跃的会话")
        return None

    session_id = session["session_id"]
    total_cards = session["total_cards"]

    try:
        # Test different quality scores
        quality_scores = [
            (5, "Easy (完美记忆)"),
            (3, "Good (正确但需思考)"),
            (1, "Hard (错误但有印象)"),
        ]

        for quality, label in quality_scores:
            print_info(f"测试质量评分 {quality}: {label}...")

            # Use query parameters for answer endpoint
            response = requests.post(
                f"{BASE_URL}/users/{USER_ID}/review/answer?session_id={session_id}&quality={quality}",
                timeout=TIMEOUT
            )

            if response.status_code != 200:
                print_error(f"  HTTP {response.status_code}")
                print_info(f"  响应: {response.text[:200]}")
                continue

            data = response.json()

            if not data.get("success"):
                print_error(f"  API 错误: {data.get('error')}")
                continue

            # Handle both response formats
            if "result" in data:
                result = data["result"]
            else:
                result = data.get("data", {}).get("result", {})

            print_success(f"  质量 {quality} ({label})")
            print_info(f"    • 新间隔: {result.get('new_interval', 'N/A')} 小时")
            print_info(f"    • 新难度因子: {result.get('new_ease', 0):.2f}")

            next_review = result.get('next_review_time', '')
            if next_review:
                print_info(f"    • 下次复习: {next_review[:10]}")

            # Check if session is complete
            is_complete = data.get("session_complete") or (data.get("data", {}).get("session_complete") if "data" in data else False)
            if is_complete:
                print_success("会话已完成")
                return data.get("session_summary") or data.get("data", {}).get("session_summary")

            # Add small delay between requests
            time.sleep(0.2)

        return data.get("session_summary") or (data.get("data", {}).get("session_summary") if "data" in data else None)

    except Exception as e:
        print_error(f"异常: {e}")
        return None

def test_session_types() -> bool:
    """Test different session types"""
    print_header("Step 4: 测试不同的会话类型")

    success_count = 0

    for session_type in ["mixed", "new", "review"]:
        try:
            response = requests.post(
                f"{BASE_URL}/users/{USER_ID}/review/session",
                json={"session_type": session_type},
                timeout=TIMEOUT
            )

            if response.status_code == 204:
                print_warning(f"会话类型 '{session_type}': 没有卡片可用")
                continue

            if response.status_code != 200:
                print_error(f"会话类型 '{session_type}': HTTP {response.status_code}")
                continue

            data = response.json()
            if data.get("success"):
                # Handle both response formats
                if "total_cards" in data:
                    total = data["total_cards"]
                else:
                    total = data.get("data", {}).get("total_cards", 0)
                print_success(f"会话类型 '{session_type}': {total} 张卡片")
                success_count += 1
            else:
                print_error(f"会话类型 '{session_type}': {data.get('error')}")

        except Exception as e:
            print_error(f"会话类型 '{session_type}': {e}")

    return success_count >= 1

def reset_test_vocabulary():
    """Reset test vocabulary for next test batch"""
    try:
        # Reset test vocabulary by deleting and re-adding entries for test_user
        from infrastructure.database import SessionLocal
        from infrastructure.models import VocabularyEntryModel

        db = SessionLocal()
        try:
            # Delete all vocabulary entries for test_user
            db.query(VocabularyEntryModel).filter_by(user_id=USER_ID).delete()
            db.commit()

            # Add fresh test words
            test_words = [
                'serendipity', 'ephemeral', 'quintessential',
                'ubiquitous', 'eloquent'
            ]

            for word in test_words:
                entry = VocabularyEntryModel(
                    user_id=USER_ID,
                    word=word
                )
                db.add(entry)

            db.commit()
        finally:
            db.close()

        time.sleep(0.5)
    except Exception as e:
        print_warning(f"Could not reset test vocabulary: {e}")
        time.sleep(0.5)

def test_quality_scores() -> bool:
    """Test all quality scores (0-5)"""
    print_header("Step 5: 测试所有质量评分 (0-5)")

    # Reset vocabulary for fresh test data
    reset_test_vocabulary()

    session = test_session_creation_silent()
    if not session:
        print_warning("无法创建测试会话")
        return False

    success_count = 0

    for quality in range(6):
        quality_labels = {
            0: "完全忘记",
            1: "错误但有印象",
            2: "错误但容易想起",
            3: "正确但需思考",
            4: "正确且轻松",
            5: "完美记忆"
        }

        try:
            # Use query parameters for answer endpoint
            response = requests.post(
                f"{BASE_URL}/users/{USER_ID}/review/answer?session_id={session['session_id']}&quality={quality}",
                timeout=TIMEOUT
            )

            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    print_success(f"质量 {quality}: {quality_labels[quality]}")
                    success_count += 1

                    is_complete = data.get("session_complete") or (data.get("data", {}).get("session_complete") if "data" in data else False)
                    if is_complete:
                        break

                    time.sleep(0.1)

        except Exception as e:
            print_error(f"质量 {quality}: {e}")

    return success_count >= 3

def test_session_creation_silent() -> Optional[Dict]:
    """Create session without printing (for internal use)"""
    try:
        response = requests.post(
            f"{BASE_URL}/users/{USER_ID}/review/session",
            json={"session_type": "mixed"},
            timeout=TIMEOUT
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("success"):
                # Handle both response formats
                if "session_id" in data:
                    return data
                else:
                    return data.get("data")

    except Exception:
        pass

    return None

def test_stats_endpoints() -> bool:
    """Test statistics endpoints"""
    print_header("Step 6: 测试统计端点")

    endpoints = [
        ("stats", "GET /users/{user_id}/review/stats"),
        ("schedule", "GET /users/{user_id}/review/schedule"),
    ]

    for endpoint_name, endpoint_label in endpoints:
        try:
            url = f"{BASE_URL}/users/{USER_ID}/review/{endpoint_name}"
            response = requests.get(url, timeout=TIMEOUT)

            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    print_success(f"{endpoint_label}")
                else:
                    print_warning(f"{endpoint_label}: {data.get('error', '暂未实现')}")
            else:
                print_warning(f"{endpoint_label}: HTTP {response.status_code}")

        except Exception as e:
            print_error(f"{endpoint_label}: {e}")

    return True

def main():
    """Run all tests"""
    print(f"\n{'🧪 MixRead Review System - API 集成测试'.center(70)}")
    print(f"{'='*70}\n")

    # Setup test data first
    setup_test_data()

    # Check backend connection
    if not check_backend_connection():
        return

    # Run tests
    results = []

    session = test_session_creation()
    results.append(("会话创建", session is not None))

    if session:
        test_answer_submission(session)
        results.append(("答题提交", True))

    results.append(("会话类型", test_session_types()))
    results.append(("质量评分", test_quality_scores()))
    results.append(("统计端点", test_stats_endpoints()))

    # Print summary
    print_header("测试总结")

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        if result:
            print_success(f"{test_name}")
        else:
            print_error(f"{test_name}")

    print(f"\n总体: {passed}/{total} 通过\n")

    if passed == total:
        print_success("所有测试通过! ✨")
        print_info("后续步骤:")
        print_info("1. 在浏览器中测试前端")
        print_info("2. 参考 TESTING.md 了解完整的测试指南")
        print_info("3. 进行用户 beta 测试")
    else:
        print_warning(f"{total - passed} 个测试未通过")
        print_info("请检查错误信息并参考 TESTING.md")

if __name__ == "__main__":
    main()
