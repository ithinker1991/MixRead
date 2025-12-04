# 测试指南 - 单词复习系统

本文档指导如何完整测试已实现的复习系统（后端API + 前端UI）。

## 一、环境准备

### 1.1 启动后端

```bash
# 进入后端目录
cd backend

# 如果没有安装依赖
pip install -r requirements.txt

# 启动 FastAPI 服务
python main.py

# 输出应该显示：
# INFO:     Uvicorn running on http://127.0.0.1:8000
```

### 1.2 启动前端测试服务器（可选）

```bash
# 在另一个终端
cd frontend

# 启动简单的 HTTP 服务器
python -m http.server 8001 --bind localhost

# 访问：http://localhost:8001/pages/review-session.html?user_id=test_user
```

## 二、API 端点测试

### 2.1 使用 curl 快速测试

#### Step 1: 启动一个复习会话

```bash
curl -X POST http://localhost:8000/users/test_user/review/session \
  -H "Content-Type: application/json" \
  -d '{"session_type": "mixed"}'
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "total_cards": 5,
    "first_card": {
      "id": "word_1",
      "front": "serendipity",
      "back": {
        "definition": "The occurrence of events by chance in a happy way",
        "example": "A fortunate stroke of serendipity brought the two friends together.",
        "cefr": "C1"
      }
    },
    "progress": {
      "current": 1,
      "total": 5,
      "percentage": 20.0,
      "correct": 0,
      "accuracy": 0.0
    }
  }
}
```

#### Step 2: 提交一个答案

```bash
# 用返回的 session_id 替换 {SESSION_ID}
curl -X POST http://localhost:8000/users/test_user/review/answer \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "{SESSION_ID}",
    "quality": 5
  }'
```

**预期响应**：
```json
{
  "success": true,
  "data": {
    "result": {
      "item_id": "word_1",
      "quality": 5,
      "new_interval": 24,
      "new_ease": 2.6,
      "next_review_time": "2025-12-05T12:34:56"
    },
    "next_card": {
      "id": "word_2",
      "front": "ephemeral",
      ...
    },
    "progress": {
      "current": 2,
      "total": 5,
      "percentage": 40.0,
      "correct": 1,
      "accuracy": 1.0
    },
    "session_complete": false
  }
}
```

### 2.2 使用 Python 进行集成测试

创建文件 `backend/tests/test_review_integration.py`：

```python
import pytest
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"
USER_ID = "test_user"

class TestReviewIntegration:
    """集成测试：Review 系统端到端"""

    def test_complete_review_flow(self):
        """完整的复习流程：启动 → 答题 → 完成"""

        # 1. 启动会话
        response = requests.post(
            f"{BASE_URL}/users/{USER_ID}/review/session",
            json={"session_type": "mixed"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        session = data["data"]
        session_id = session["session_id"]
        total_cards = session["total_cards"]

        print(f"Session started: {session_id}, {total_cards} cards")

        # 2. 答题（模拟用户逐张卡片答题）
        correct_count = 0
        for i in range(min(total_cards, 3)):  # 只测试前3张
            # 提交答案
            response = requests.post(
                f"{BASE_URL}/users/{USER_ID}/review/answer",
                json={"session_id": session_id, "quality": 5}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True

            result = data["data"]
            print(f"Card {i+1}: quality=5, next_interval={result['result']['new_interval']}h")

            # 检查审查结果
            assert result["result"]["quality"] == 5
            assert result["result"]["new_interval"] > 0
            assert result["result"]["new_ease"] >= 1.3

            correct_count += 1

            # 检查会话是否完成
            if result["session_complete"]:
                print(f"Session completed after {i+1} cards")
                print(f"Summary: {result['session_summary']}")
                break

    def test_session_types(self):
        """测试不同的会话类型"""

        for session_type in ["mixed", "new", "review"]:
            response = requests.post(
                f"{BASE_URL}/users/{USER_ID}/review/session",
                json={"session_type": session_type}
            )

            assert response.status_code in [200, 204]  # 204 if no cards
            if response.status_code == 200:
                data = response.json()
                assert data["success"] is True
                print(f"✓ {session_type}: {data['data']['total_cards']} cards")

    def test_quality_scores(self):
        """测试所有难度评分 (0-5)"""

        response = requests.post(
            f"{BASE_URL}/users/{USER_ID}/review/session",
            json={"session_type": "mixed"}
        )

        if response.status_code != 200:
            pytest.skip("No cards available")
            return

        session = response.json()["data"]
        session_id = session["session_id"]

        # 测试所有质量评分
        for quality in [0, 1, 2, 3, 4, 5]:
            response = requests.post(
                f"{BASE_URL}/users/{USER_ID}/review/answer",
                json={"session_id": session_id, "quality": quality}
            )

            assert response.status_code == 200
            data = response.json()
            assert data["data"]["result"]["quality"] == quality

            # 如果会话结束，停止
            if data["data"]["session_complete"]:
                break

            print(f"✓ Quality {quality}: interval={data['data']['result']['new_interval']}h")

if __name__ == "__main__":
    # 运行测试
    test = TestReviewIntegration()
    test.test_complete_review_flow()
    test.test_session_types()
    test.test_quality_scores()
    print("\n✅ All integration tests passed!")
```

**运行测试**：
```bash
cd backend
python tests/test_review_integration.py
```

## 三、前端 UI 测试

### 3.1 打开 Review 页面

```
打开浏览器：http://localhost:8001/pages/review-session.html?user_id=test_user
```

### 3.2 功能检查清单

- [ ] **页面加载**
  - 看到"Choose Review Type"按钮
  - 没有控制台错误
  - ReviewManager 加载成功

- [ ] **启动会话**
  - 点击"Mixed (New + Due)"
  - 看到进度条（1 / N）
  - 显示第一张卡片的单词

- [ ] **卡片翻转**
  - 点击"Show Answer"或按 Space
  - 卡片翻转显示定义和例句
  - 显示4个评分按钮

- [ ] **提交答案**
  - 点击"Easy"按钮 （数据-quality=5）
  - 进度条更新
  - 正确计数增加
  - 显示下一张卡片

- [ ] **快捷键**
  - 按 Space 显示答案
  - 按 1 (Again) / 2 (Hard) / 3 (Good) / 4 (Easy)
  - 快捷键正确提交答案

- [ ] **暂停/继续**
  - 点击"Pause"按钮
  - 计时器停止
  - 按钮变为"Resume"

- [ ] **会话完成**
  - 显示完成屏幕
  - 显示统计：卡片数、正确率、最长连续数
  - 可以返回或开始新会话

### 3.3 控制台日志检查

按 F12 打开控制台，应该看到：

```
[Review] Starting mixed session for user test_user
[Review] Session started: {session_id}, 5 cards
[Review] Submitting answer: quality=5, time=2345ms
[Review] Answer recorded. Correct: 1, Streak: 1
[Review] Session ended: { ... }
```

## 四、数据库验证

### 4.1 检查单词是否更新

```python
# backend/test_db_check.py
from infrastructure.repositories import VocabularyRepository
from infrastructure.database import get_db

db = next(get_db())
repo = VocabularyRepository(db)

# 查询 test_user 的单词
words = repo.get_by_status(user_id="test_user", status="REVIEWING", limit=5)

for word in words:
    print(f"""
    Word: {word.word}
    - Next Review: {word.next_review}
    - Ease Factor: {word.ease_factor}
    - Total Reviews: {word.total_reviews}
    - Correct: {word.correct_reviews}
    - Streak: {word.review_streak}
    """)
```

## 五、完整的 E2E 测试流程

### 5.1 自动化 E2E 测试

创建 `backend/tests/test_review_e2e.py`：

```python
import time
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class TestReviewE2E:
    """E2E 测试：从前端用户操作到后端数据验证"""

    @classmethod
    def setup_class(cls):
        cls.driver = webdriver.Chrome()
        cls.wait = WebDriverWait(cls.driver, 10)

    @classmethod
    def teardown_class(cls):
        cls.driver.quit()

    def test_complete_review_session(self):
        """完整会话：启动 → 答题 → 完成"""

        # 打开页面
        self.driver.get("http://localhost:8001/pages/review-session.html?user_id=test_user")

        # 等待页面加载
        self.wait.until(EC.presence_of_element_located((By.ID, "mixed-btn")))

        # 点击"Mixed"按钮
        self.driver.find_element(By.ID, "mixed-btn").click()

        # 等待卡片显示
        self.wait.until(EC.presence_of_element_located((By.ID, "word-text")))

        # 获取单词
        word = self.driver.find_element(By.ID, "word-text").text
        print(f"Reviewing word: {word}")

        # 按 Space 显示答案
        self.driver.find_element(By.TAG_NAME, "body").send_keys(Keys.SPACE)
        time.sleep(0.5)

        # 点击"Easy"按钮 (quality=5)
        easy_btn = self.driver.find_element(By.CSS_SELECTOR, "[data-quality='5']")
        easy_btn.click()

        # 等待下一张卡片或完成
        time.sleep(1)

        # 检查进度更新
        current = self.driver.find_element(By.ID, "current-card").text
        assert current != "1", "Card should advance"

        print("✅ E2E test passed!")

if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
```

**运行 E2E 测试**（需要 Selenium 和 ChromeDriver）：
```bash
pip install selenium
# 下载 chromedriver: https://chromedriver.chromium.org/
python -m pytest tests/test_review_e2e.py -v
```

## 六、性能测试

### 6.1 负载测试

```python
# backend/tests/test_review_performance.py
import requests
import time
from concurrent.futures import ThreadPoolExecutor

BASE_URL = "http://localhost:8000"

def test_session_creation_speed():
    """测试会话创建的速度"""

    start_time = time.time()
    response = requests.post(
        f"{BASE_URL}/users/test_user/review/session",
        json={"session_type": "mixed"}
    )
    elapsed = time.time() - start_time

    print(f"Session creation: {elapsed*1000:.2f}ms")
    assert elapsed < 1.0, "Session creation should be < 1s"

def test_concurrent_sessions():
    """测试并发会话"""

    def create_session(user_id):
        response = requests.post(
            f"{BASE_URL}/users/{user_id}/review/session",
            json={"session_type": "mixed"}
        )
        return response.status_code

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [
            executor.submit(create_session, f"user_{i}")
            for i in range(10)
        ]
        results = [f.result() for f in futures]

    success_count = sum(1 for r in results if r == 200)
    print(f"Concurrent sessions: {success_count}/10 successful")
    assert success_count >= 8, "At least 80% success rate"

if __name__ == "__main__":
    test_session_creation_speed()
    test_concurrent_sessions()
    print("✅ Performance tests passed!")
```

## 七、测试检查清单

### 完整测试前的准备

```
[ ] 后端已启动 (python main.py)
[ ] 数据库已初始化
[ ] 有测试数据（至少 5 个单词）
[ ] 前端服务器已启动 (optional)
```

### 必做测试

```
[ ] 单位测试：SRS 算法 (pytest backend/srs_core/tests/)
[ ] API 测试：curl 或 Python 脚本
[ ] UI 测试：手动打开 HTML 页面并操作
[ ] 数据库验证：检查数据是否正确保存
```

### 可选测试

```
[ ] E2E 测试：Selenium 自动化
[ ] 性能测试：并发和响应时间
[ ] 边界测试：错误处理、会话超时
```

## 八、故障排除

### 8.1 常见问题

| 问题 | 解决方案 |
|------|--------|
| API 返回 404 | 确认路由已在 main.py 中注册 |
| CORS 错误 | 检查 main.py 中的 CORSMiddleware 配置 |
| 卡片不显示 | 检查数据库中是否有测试数据 |
| 快捷键不工作 | 确认 reviewManager.js 已加载 |
| 前端报错 | F12 查看控制台，检查 API URL 是否正确 |

### 8.2 调试模式

```javascript
// 在 review-session.html 的 <script> 中添加
localStorage.setItem('review-debug', 'true');

// 在 review-manager.js 中会自动输出详细日志
```

## 九、测试报告模板

测试完成后，填写：

```
=== MixRead Review System Test Report ===

Date: 2025-12-04
Tester: [Your Name]

[✓] Backend API Tests
  - Session creation: PASS
  - Answer submission: PASS
  - Quality scores: PASS

[✓] Frontend UI Tests
  - Card display: PASS
  - Answer submission: PASS
  - Keyboard shortcuts: PASS

[✓] Database Tests
  - Data persistence: PASS
  - Review intervals: PASS

[✓] Performance Tests
  - Session creation: 150ms
  - Answer submission: 200ms

Summary: All tests passed! Ready for user testing.
```

---

**下一步**：根据测试结果，修复任何问题后，系统就可以进行用户 beta 测试了。