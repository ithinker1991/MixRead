"""
API Endpoint Tests
测试所有后端 API 端点的功能和正确性
"""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app, load_cefr_data, load_chinese_dict

# Load data before creating test client
load_cefr_data()
load_chinese_dict()

client = TestClient(app)


class TestHealthEndpoint:
    """测试健康检查端点"""

    def test_health_check_returns_200(self):
        """健康检查应该返回 200 状态码"""
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_check_returns_correct_data(self):
        """健康检查应该返回正确的数据结构"""
        response = client.get("/health")
        data = response.json()

        assert "status" in data
        assert "words_loaded" in data
        assert data["status"] == "ok"
        assert data["words_loaded"] > 0

    def test_health_check_words_loaded(self):
        """健康检查应该显示加载的词汇数量"""
        response = client.get("/health")
        data = response.json()

        # CEFR 数据库应该有 6860 词
        assert data["words_loaded"] == 6860


class TestWordEndpoint:
    """测试单词查询端点"""

    def test_word_endpoint_basic(self):
        """测试基本的单词查询"""
        response = client.get("/word/beautiful")
        assert response.status_code == 200

    def test_word_found_in_database(self):
        """测试在数据库中的单词"""
        response = client.get("/word/beautiful")
        data = response.json()

        assert data["word"] == "beautiful"
        assert data["found"] == True
        assert data["cefr_level"] is not None
        assert data["chinese"] is not None

    def test_word_has_chinese_translation(self):
        """测试单词必须有中文翻译"""
        test_words = ["beautiful", "climate", "philosophy", "flexible"]

        for word in test_words:
            response = client.get(f"/word/{word}")
            data = response.json()

            assert data["chinese"] is not None, f"{word} should have Chinese translation"
            assert len(data["chinese"]) > 0, f"{word} Chinese translation should not be empty"
            assert len(data["chinese"]) <= 8, f"{word} Chinese translation should be concise"

    def test_word_not_found(self):
        """测试不在数据库中的单词"""
        response = client.get("/word/nonexistentword12345")
        data = response.json()

        assert data["word"] == "nonexistentword12345"
        assert data["found"] == False

    def test_word_case_insensitive(self):
        """测试单词查询不区分大小写"""
        lower_response = client.get("/word/beautiful")
        upper_response = client.get("/word/BEAUTIFUL")

        lower_data = lower_response.json()
        upper_data = upper_response.json()

        assert lower_data["found"] == upper_data["found"]
        assert lower_data["cefr_level"] == upper_data["cefr_level"]


class TestHighlightWordsEndpoint:
    """测试批量高亮判断端点"""

    def test_highlight_words_basic(self):
        """测试基本的批量高亮功能"""
        response = client.post(
            "/highlight-words",
            json={
                "words": ["beautiful", "climate", "test"],
                "difficulty_level": "B1"
            }
        )

        assert response.status_code == 200

    def test_highlight_words_returns_correct_structure(self):
        """测试返回的数据结构"""
        response = client.post(
            "/highlight-words",
            json={
                "words": ["beautiful", "climate"],
                "difficulty_level": "B1"
            }
        )

        data = response.json()

        assert "difficulty_level" in data
        assert "total_words" in data
        assert "highlighted_count" in data
        assert "highlighted_words" in data
        assert "word_details" in data

    def test_all_highlighted_words_have_chinese(self):
        """核心测试：所有高亮词必须有中文翻译"""
        test_cases = [
            {
                "words": ["climate", "change", "beautiful", "test"],
                "difficulty_level": "A1"
            },
            {
                "words": ["philosophy", "flexible", "curve", "learning"],
                "difficulty_level": "B1"
            },
            {
                "words": ["unprecedented", "substantial", "comprehensive"],
                "difficulty_level": "B2"
            }
        ]

        for test_case in test_cases:
            response = client.post("/highlight-words", json=test_case)
            data = response.json()

            # 所有 word_details 中的词都必须有中文
            for detail in data["word_details"]:
                assert "chinese" in detail, f"Word {detail['word']} missing chinese field"
                assert detail["chinese"] is not None, f"Word {detail['word']} has null chinese"
                assert len(detail["chinese"]) > 0, f"Word {detail['word']} has empty chinese"

    def test_highlight_respects_difficulty_level(self):
        """测试难度级别筛选"""
        # A1 级别应该高亮更少词汇
        a1_response = client.post(
            "/highlight-words",
            json={"words": ["beautiful", "climate", "philosophy"], "difficulty_level": "A1"}
        )

        # B2 级别应该高亮更多词汇
        b2_response = client.post(
            "/highlight-words",
            json={"words": ["beautiful", "climate", "philosophy"], "difficulty_level": "B2"}
        )

        a1_data = a1_response.json()
        b2_data = b2_response.json()

        # B2 高亮数应该 >= A1
        assert b2_data["highlighted_count"] >= a1_data["highlighted_count"]

    def test_empty_words_list(self):
        """测试空单词列表"""
        response = client.post(
            "/highlight-words",
            json={"words": [], "difficulty_level": "B1"}
        )

        data = response.json()
        assert data["total_words"] == 0
        assert data["highlighted_count"] == 0
        assert len(data["highlighted_words"]) == 0

    def test_duplicate_words(self):
        """测试重复单词"""
        response = client.post(
            "/highlight-words",
            json={
                "words": ["beautiful", "beautiful", "climate"],
                "difficulty_level": "B1"
            }
        )

        data = response.json()
        # 应该正确处理重复词
        assert data["total_words"] == 3

    def test_translation_quality(self):
        """测试翻译质量：简洁、无脏数据"""
        response = client.post(
            "/highlight-words",
            json={
                "words": ["philosophy", "flexible", "curve"],
                "difficulty_level": "B1"
            }
        )

        data = response.json()

        for detail in data["word_details"]:
            chinese = detail["chinese"]

            # 翻译应该简洁（<= 8 字符）
            assert len(chinese) <= 8, f"{detail['word']}: {chinese} too long"

            # 不应包含脏数据
            assert ",," not in chinese, f"{detail['word']}: contains ,,"
            assert "\"" not in chinese, f"{detail['word']}: contains quotes"
            assert not chinese.endswith(","), f"{detail['word']}: ends with comma"


class TestAPIPerformance:
    """测试 API 性能"""

    def test_health_endpoint_performance(self):
        """健康检查应该快速响应"""
        import time

        start = time.time()
        response = client.get("/health")
        duration = time.time() - start

        assert response.status_code == 200
        assert duration < 0.1  # 应该在 100ms 内完成

    def test_word_endpoint_performance(self):
        """单词查询应该快速响应"""
        import time

        start = time.time()
        response = client.get("/word/beautiful")
        duration = time.time() - start

        assert response.status_code == 200
        assert duration < 0.5  # 应该在 500ms 内完成

    def test_batch_highlight_performance(self):
        """批量高亮应该能处理大量单词"""
        import time

        # 生成 100 个测试单词
        words = [f"word{i}" for i in range(100)]

        start = time.time()
        response = client.post(
            "/highlight-words",
            json={"words": words, "difficulty_level": "B1"}
        )
        duration = time.time() - start

        assert response.status_code == 200
        assert duration < 2.0  # 100个词应该在2秒内完成


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
