# 自动化测试方案

## 核心原则

1. **自动化优先**：99%的测试应该自动运行，不需要手动干预
2. **用户参与最小化**：只需review测试case，不需要手动执行测试
3. **快速反馈**：单位测试秒级运行，完整测试5分钟内
4. **实用性**：只测试关键业务逻辑，不过度测试
5. **易于维护**：测试代码和产品代码一样清晰

---

## 第一部分：测试金字塔结构

```
        △
       /|\
      / | \
     /  |  \  E2E Tests (5%)
    /   |   \
   /    |    \
  /     |     \───────────────
 /      |      \
/       |       \  Integration Tests (15%)
/        |        \
─────────┼─────────────────────
         |
         |  Unit Tests (80%)
         |
```

### 测试分布

| 测试类型 | 比例 | 运行时间 | 范围 | 工具 |
|---------|------|--------|------|------|
| **单元测试** | 80% | <1s/test | 单个函数/类 | pytest + unittest |
| **集成测试** | 15% | 1-5s/test | 多个模块组合 | pytest + test fixtures |
| **E2E测试** | 5% | 10-30s/test | 完整业务流程 | Selenium/Playwright |

---

## 第二部分：后端测试方案

### 环境配置

#### requirements-dev.txt（新增）
```
pytest==7.4.0              # 测试框架
pytest-cov==4.1.0         # 覆盖率报告
pytest-asyncio==0.21.0    # 异步测试支持
pytest-mock==3.11.1       # Mock支持
factory-boy==3.2.0        # 测试数据工厂
sqlalchemy==2.0.0         # ORM
pytest-sqlalchemy==0.1.0  # SQLAlchemy测试工具
```

### 目录结构（新增）

```
backend/
├── main.py
├── requirements.txt
├── requirements-dev.txt     # 新增
│
├── domain/
│   ├── models/
│   ├── services/
│   └── __init__.py
│
├── application/
│   └── services/
│
├── infrastructure/
│   ├── repositories/
│   ├── database.py          # 新增：SQLAlchemy配置
│   └── __init__.py
│
├── api/
│   └── routes/
│
├── tests/                   # 新增：测试目录
│   ├── conftest.py          # pytest配置和fixtures
│   ├── factories/           # 测试数据工厂
│   │   ├── __init__.py
│   │   └── model_factories.py
│   │
│   ├── unit/                # 单元测试
│   │   ├── test_word_model.py
│   │   ├── test_vocabulary_model.py
│   │   ├── test_highlight_service.py
│   │   └── __init__.py
│   │
│   ├── integration/         # 集成测试
│   │   ├── test_user_application.py
│   │   ├── test_highlight_application.py
│   │   ├── test_api_endpoints.py
│   │   └── __init__.py
│   │
│   ├── e2e/                 # 端到端测试
│   │   ├── test_mark_as_known_flow.py
│   │   ├── test_add_vocabulary_flow.py
│   │   └── __init__.py
│   │
│   └── fixtures/            # 测试fixture
│       ├── test_data.json
│       └── __init__.py
```

---

### 测试框架详解

#### 1. 配置文件：conftest.py

```python
# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager

# 使用内存数据库进行测试
TEST_DATABASE_URL = "sqlite:///:memory:"

@pytest.fixture(scope="session")
def db_engine():
    """创建测试数据库"""
    engine = create_engine(TEST_DATABASE_URL, echo=False)
    # 创建所有表
    Base.metadata.create_all(engine)
    yield engine
    # 测试后清理
    Base.metadata.drop_all(engine)

@pytest.fixture
def db_session(db_engine):
    """为每个测试提供数据库session"""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def app_context(db_session):
    """应用上下文"""
    return {
        'db': db_session,
        'test_mode': True
    }
```

#### 2. 测试数据工厂：factories/model_factories.py

```python
# tests/factories/model_factories.py
import factory
from datetime import datetime
from domain.models.user import User
from domain.models.vocabulary import VocabularyEntry, VocabularyStatus

class UserFactory(factory.Factory):
    """用户测试数据工厂"""
    class Meta:
        model = User

    user_id = factory.Sequence(lambda n: f"test-user-{n}")
    known_words = set()
    vocabulary = {}
    created_at = datetime.now()

class VocabularyEntryFactory(factory.Factory):
    """词汇库条目工厂"""
    class Meta:
        model = VocabularyEntry

    word = factory.Sequence(lambda n: f"word{n}")
    status = VocabularyStatus.LEARNING
    attempt_count = 0
    last_reviewed = None
```

#### 3. 单元测试示例：test_highlight_service.py

```python
# tests/unit/test_highlight_service.py
import pytest
from domain.models.word import Word
from domain.services.highlight_service import HighlightService

class TestHighlightService:
    """高亗过滤服务的单元测试"""

    def test_should_highlight_basic_case(self):
        """
        场景：基础高亗判断
        输入：word="beautiful", user_difficulty="B1", known_words={}
        期望：返回True（应该高亗）
        """
        word = Word("beautiful", "B1")
        user_difficulty = "B1"
        known_words = set()

        result = HighlightService.should_highlight(
            word, user_difficulty, known_words
        )

        assert result is True

    def test_should_not_highlight_known_word(self):
        """
        场景：已认识的词不高亗
        输入：word="beautiful", known_words={"beautiful"}
        期望：返回False
        """
        word = Word("beautiful", "B1")
        user_difficulty = "B1"
        known_words = {"beautiful"}

        result = HighlightService.should_highlight(
            word, user_difficulty, known_words
        )

        assert result is False

    def test_should_not_highlight_easier_words(self):
        """
        场景：简单词不高亗
        输入：word="good" (A1), user_difficulty="B1"
        期望：返回False
        """
        word = Word("good", "A1")
        user_difficulty = "B1"
        known_words = set()

        result = HighlightService.should_highlight(
            word, user_difficulty, known_words
        )

        assert result is False

    def test_should_highlight_harder_words(self):
        """
        场景：难于用户级别的词应该高亗
        输入：word="serendipity" (C1), user_difficulty="B1"
        期望：返回True
        """
        word = Word("serendipity", "C1")
        user_difficulty = "B1"
        known_words = set()

        result = HighlightService.should_highlight(
            word, user_difficulty, known_words
        )

        assert result is True
```

#### 4. 集成测试示例：test_user_application.py

```python
# tests/integration/test_user_application.py
import pytest
from factories.model_factories import UserFactory
from application.services.user_application import UserApplicationService
from infrastructure.repositories.user_repository import UserRepository

@pytest.fixture
def user_app(db_session):
    """集成测试的应用服务"""
    repo = UserRepository(db_session)
    return UserApplicationService(repo)

class TestUserApplicationService:
    """用户应用服务集成测试"""

    def test_mark_word_as_known_flow(self, user_app, db_session):
        """
        场景：用户标记单词为已认识（完整流程）
        步骤：
        1. 创建新用户
        2. 标记单词"beautiful"为已认识
        3. 验证数据持久化
        期望：数据库中记录已保存
        """
        # 1. 初始化
        user_id = "test-user-123"
        word = "beautiful"

        # 2. 执行操作
        result = user_app.mark_word_as_known(user_id, word)

        # 3. 验证
        assert result["success"] is True

        # 4. 验证数据持久化
        saved_user = user_app.user_repository.get_user(user_id)
        assert word.lower() in saved_user.known_words

    def test_add_to_vocabulary_flow(self, user_app, db_session):
        """
        场景：用户添加单词到词汇库
        步骤：
        1. 创建用户
        2. 添加单词到词汇库
        3. 验证词汇库已保存
        期望：词汇库记录存在
        """
        user_id = "test-user-456"
        word = "serendipity"

        result = user_app.add_to_vocabulary(user_id, word)

        assert result["success"] is True

        saved_user = user_app.user_repository.get_user(user_id)
        assert word.lower() in saved_user.vocabulary
```

#### 5. 端到端测试示例：test_mark_as_known_flow.py

```python
# tests/e2e/test_mark_as_known_flow.py
import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    """FastAPI测试客户端"""
    return TestClient(app)

class TestMarkAsKnownFlow:
    """完整的'标记已认识'业务流程测试"""

    def test_complete_mark_as_known_flow(self, client):
        """
        完整流程测试：
        1. 用户请求获取高亗单词 (包含"beautiful")
        2. 用户点击标记"beautiful"为已认识
        3. 重新请求高亗单词
        4. 验证"beautiful"不再高亗
        """
        user_id = "test-user-flow-1"

        # 第一步：初始高亗（应该包含"beautiful"）
        response1 = client.post("/highlight-words", json={
            "user_id": user_id,
            "words": ["beautiful", "good", "serendipity"],
            "difficulty_level": "B1"
        })
        assert response1.status_code == 200
        data1 = response1.json()
        assert "beautiful" in data1["highlighted_words"]

        # 第二步：标记为已认识
        response2 = client.post(f"/users/{user_id}/known-words", json={
            "word": "beautiful"
        })
        assert response2.status_code == 200
        assert response2.json()["success"] is True

        # 第三步：重新请求高亗
        response3 = client.post("/highlight-words", json={
            "user_id": user_id,
            "words": ["beautiful", "good", "serendipity"],
            "difficulty_level": "B1"
        })
        assert response3.status_code == 200
        data3 = response3.json()
        assert "beautiful" not in data3["highlighted_words"]

    def test_vocabulary_and_known_words_separation(self, client):
        """
        测试词汇库和已认识单词的独立性：
        1. 添加"beautiful"到词汇库
        2. 标记"beautiful"为已认识
        3. 验证都被记录，但不再高亗
        """
        user_id = "test-user-flow-2"

        # 添加到词汇库
        r1 = client.post(f"/users/{user_id}/vocabulary", json={
            "word": "beautiful"
        })
        assert r1.status_code == 200

        # 标记为已认识
        r2 = client.post(f"/users/{user_id}/known-words", json={
            "word": "beautiful"
        })
        assert r2.status_code == 200

        # 验证两个列表都包含该单词
        r3 = client.get(f"/users/{user_id}/vocabulary")
        r4 = client.get(f"/users/{user_id}/known-words")

        assert "beautiful" in r3.json()["vocabulary"]
        assert "beautiful" in r4.json()["known_words"]
```

---

### 运行测试的命令

```bash
# 运行所有测试
pytest

# 运行单元测试
pytest tests/unit/

# 运行集成测试
pytest tests/integration/

# 运行E2E测试
pytest tests/e2e/

# 运行特定测试
pytest tests/unit/test_highlight_service.py::TestHighlightService::test_should_highlight_basic_case

# 生成覆盖率报告
pytest --cov=domain --cov=application --cov=infrastructure --cov-report=html

# 显示详细输出
pytest -v

# 并行运行（加快速度）
pytest -n auto
```

---

## 第三部分：前端测试方案

### 目录结构

```
frontend/
├── tests/                   # 新增
│   ├── unit/
│   │   ├── modules/
│   │   │   ├── test-known-words-store.js
│   │   │   ├── test-user-store.js
│   │   │   └── test-highlight-filter.js
│   │   └── scripts/
│   │       └── test-api-client.js
│   │
│   ├── integration/
│   │   └── test-content-script-flow.js
│   │
│   └── fixtures/
│       └── mock-data.js
│
├── modules/
├── scripts/
├── popup.js
└── content.js
```

### 前端测试工具

```
// package.json（新增）
{
  "devDependencies": {
    "jest": "^29.0.0",
    "@testing-library/dom": "^9.0.0",
    "sinon": "^15.0.0"
  }
}
```

### 单元测试示例：test-known-words-store.js

```javascript
// tests/unit/modules/test-known-words-store.js
describe('KnownWordsStore', () => {
  let store;

  beforeEach(() => {
    store = new KnownWordsStore();
  });

  describe('add()', () => {
    test('should add word to known words', () => {
      /**
       * 场景：添加单词
       * 输入：word = "beautiful"
       * 期望：store.has("beautiful") === true
       */
      store.add('beautiful');
      expect(store.has('beautiful')).toBe(true);
    });

    test('should be case insensitive', () => {
      /**
       * 场景：大小写不敏感
       * 输入：word = "Beautiful"
       * 期望：store.has("beautiful") === true
       */
      store.add('Beautiful');
      expect(store.has('beautiful')).toBe(true);
    });

    test('should trigger listener on add', () => {
      /**
       * 场景：通知监听者
       * 步骤：
       * 1. 添加监听者
       * 2. 添加单词
       * 期望：监听者被调用
       */
      const listener = jest.fn();
      store.subscribe(listener);

      store.add('beautiful');

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('has()', () => {
    test('should return false for unknown word', () => {
      /**
       * 场景：查询不存在的单词
       * 输入：word = "nonexistent"
       * 期望：返回false
       */
      expect(store.has('nonexistent')).toBe(false);
    });

    test('should return true for known word', () => {
      /**
       * 场景：查询已添加的单词
       * 步骤：
       * 1. 先添加单词
       * 2. 再查询
       * 期望：返回true
       */
      store.add('beautiful');
      expect(store.has('beautiful')).toBe(true);
    });
  });
});
```

### 集成测试示例：test-content-script-flow.js

```javascript
// tests/integration/test-content-script-flow.js
describe('Content Script Integration', () => {
  let knownWordsStore, highlightFilter, renderer;
  let mockApiClient;

  beforeEach(() => {
    // 准备测试环境
    knownWordsStore = new KnownWordsStore();
    highlightFilter = new HighlightFilter(knownWordsStore);
    renderer = new HighlightRenderer();

    mockApiClient = {
      post: jest.fn().mockResolvedValue({
        success: true,
        highlighted_words: ['beautiful', 'serendipity']
      })
    };
  });

  test('should mark word as known and remove highlight', async () => {
    /**
     * 完整流程：标记已认识
     * 步骤：
     * 1. 获取高亗单词列表（包含"beautiful"）
     * 2. 用户标记"beautiful"为已认识
     * 3. 重新高亗
     * 4. 验证"beautiful"不再被高亗
     */
    // 初始高亗
    const words1 = ['beautiful', 'good', 'serendipity'];
    const highlighted1 = await highlightFilter.getHighlightedWords(words1);
    expect(highlighted1).toContain('beautiful');

    // 标记为已认识
    knownWordsStore.add('beautiful');

    // 再次高亗
    const highlighted2 = await highlightFilter.getHighlightedWords(words1);
    expect(highlighted2).not.toContain('beautiful');
  });
});
```

---

## 第四部分：测试Case模板（给用户review）

### 用户需要Review的测试Case格式

```markdown
## 测试Case Template

### TestCase: [标题]

**场景描述**：用户完成的业务流程

**前置条件**：
- 条件1
- 条件2

**测试步骤**：
1. 第一步操作
2. 第二步操作
3. 第三步操作

**期望结果**：
- 断言1
- 断言2
- 断言3

**数据验证**：
- 数据库状态: ...
- API响应: ...
```

### 具体例子：用户确认后的TestCase列表

```markdown
## Happy Path Tests

### TestCase 1: Mark Word as Known
**场景描述**：用户在阅读时发现已经认识的词被高亗，点击"Mark as Known"

**前置条件**：
- 用户已登录（user_id="test-user-001"）
- 页面包含词语"beautiful"（CEFR B1级别）

**测试步骤**：
1. GET /highlight-words?user_id=test-user-001&words=["beautiful"]&difficulty=B1
2. 验证响应包含"beautiful"在highlighted_words中
3. POST /users/test-user-001/known-words {"word": "beautiful"}
4. GET /highlight-words?user_id=test-user-001&words=["beautiful"]&difficulty=B1
5. 验证响应不包含"beautiful"在highlighted_words中

**期望结果**：
- Step 2: "beautiful" in highlighted_words ✓
- Step 3: API返回 {"success": true}
- Step 5: "beautiful" NOT in highlighted_words ✓

**数据验证**：
- DB: users["test-user-001"].known_words 包含 "beautiful"
- 文件: test-user-001.json 已保存

---

### TestCase 2: Add Word to Vocabulary
**场景描述**：用户点击"Add to Library"保存新词到词汇库

**前置条件**：
- 用户已登录（user_id="test-user-001"）
- 词语"serendipity"（CEFR C1级别）未在词汇库中

**测试步骤**：
1. POST /users/test-user-001/vocabulary {"word": "serendipity"}
2. GET /users/test-user-001/vocabulary
3. 验证响应包含"serendipity"

**期望结果**：
- Step 1: API返回 {"success": true}
- Step 2: vocabulary列表包含"serendipity" ✓

**数据验证**：
- DB: users["test-user-001"].vocabulary["serendipity"].status == "learning"

---

### TestCase 3: Switch Device (Same User ID)
**场景描述**：用户在新设备上输入同一个user_id，应该看到之前的词汇库

**前置条件**：
- 设备A：user_id="test-user-002"，已添加5个单词到词汇库
- 设备B：新设备

**测试步骤**：
1. 设备B输入user_id="test-user-002"
2. GET /users/test-user-002/vocabulary
3. 验证返回的词汇库包含原来的5个单词

**期望结果**：
- Step 2: vocabulary包含 ["word1", "word2", "word3", "word4", "word5"] ✓

**数据验证**：
- 两个设备获取的vocabulary完全相同

---

### TestCase 4: Highlighting with Mixed User State
**场景描述**：混合状态下的高亗逻辑

**前置条件**：
- 用户known_words包含: ["good", "beautiful"]
- 用户vocabulary包含: ["serendipity", "ephemeral"]
- 页面词汇: ["good", "beautiful", "serendipity", "ephemeral", "amazing"]
- 用户难度: B1

**测试步骤**：
1. POST /highlight-words {
     "user_id": "test-user-001",
     "words": ["good", "beautiful", "serendipity", "ephemeral", "amazing"],
     "difficulty_level": "B1"
   }

**期望结果**：
- highlighted_words = ["serendipity", "ephemeral", "amazing"]
- NOT highlighted: ["good", "beautiful"]（已认识）

**验证理由**：
- "good" (A1): 难度低于B1 → 不高亗
- "beautiful" (B1): 在known_words中 → 不高亗
- "serendipity" (C1): 难度≥B1，不在known_words → 高亗 ✓
- "ephemeral" (B2): 难度≥B1，不在known_words → 高亗 ✓
- "amazing" (A2): 难度低于B1 → 不高亗
```

---

## 第五部分：CI/CD自动化

### .github/workflows/test.yml（新增）

```yaml
name: Automated Tests

on: [push, pull_request]

jobs:
  backend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: |
          pip install -r backend/requirements.txt
          pip install -r backend/requirements-dev.txt
      - name: Run tests
        run: |
          cd backend && pytest --cov=domain --cov=application --cov-report=term
      - name: Check coverage
        run: |
          cd backend && pytest --cov=domain --cov=application --cov-fail-under=70

  frontend-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test

  code-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Linting
        run: |
          pip install flake8
          flake8 backend --max-line-length=100
```

### 本地运行脚本：run-tests.sh（新增）

```bash
#!/bin/bash

echo "🧪 Running MixRead Tests..."

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 后端测试
echo -e "${YELLOW}[1/4] Running Backend Unit Tests...${NC}"
cd backend && pytest tests/unit/ -v
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Unit tests failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Unit tests passed${NC}"

echo -e "${YELLOW}[2/4] Running Backend Integration Tests...${NC}"
pytest tests/integration/ -v
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Integration tests failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Integration tests passed${NC}"

echo -e "${YELLOW}[3/4] Running Backend E2E Tests...${NC}"
pytest tests/e2e/ -v
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ E2E tests failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ E2E tests passed${NC}"

cd ..

# 前端测试
echo -e "${YELLOW}[4/4] Running Frontend Tests...${NC}"
cd frontend && npm test
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Frontend tests failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Frontend tests passed${NC}"

cd ..

# 生成报告
echo -e "${YELLOW}Generating coverage report...${NC}"
cd backend && pytest --cov=domain --cov=application --cov=infrastructure --cov-report=html
echo -e "${GREEN}✅ Coverage report generated: htmlcov/index.html${NC}"

echo -e "${GREEN}✅ All tests passed!${NC}"
```

---

## 第六部分：工作流总结

### 对于用户

```
开发前：
1. ✅ 收到测试Case列表（按上面的格式）
2. ✅ 用户review和批准
3. ✅ 开始开发

开发中：
1. 😴 自动运行单元测试（秒级）
2. 😴 自动运行集成测试（分钟级）
3. 😴 自动生成覆盖率报告

Push到GitHub：
1. 😴 CI/CD自动运行所有测试
2. 😴 自动检查代码覆盖率
3. ✅ 测试通过才能merge PR

验收阶段：
1. ✅ 运行E2E测试（手动验证复杂流程）
2. ✅ 用户review功能是否符合预期

```

### 自动化程度

| 阶段 | 自动化 | 用户参与 |
|------|--------|--------|
| **开发前** | ✓ Case生成 | Review case |
| **单元测试** | ✓ 自动运行 | 无 |
| **集成测试** | ✓ 自动运行 | 无 |
| **E2E测试** | ✓ 自动运行 | 无 |
| **CI/CD** | ✓ GitHub Actions | 无 |
| **覆盖率** | ✓ 自动检测 | 无 |

**用户只需参与：** Review测试case、验收功能

---

## 关键指标

- 📊 **代码覆盖率目标**：≥70%（core logic）
- ⚡ **单元测试运行时间**：<30秒（全部）
- ⏱️ **完整测试周期**：<5分钟
- 🎯 **关键业务流程**：100% E2E测试覆盖

---

## 后续可选

当项目成熟后，可以添加：
- 性能测试（Locust）
- 负载测试（Apache Bench）
- 安全扫描（OWASP）
- 契约测试（Pact）

但目前不需要。
