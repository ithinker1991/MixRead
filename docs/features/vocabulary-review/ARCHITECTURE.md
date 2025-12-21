# 可复用的记忆系统核心库架构

## 核心思想

将记忆系统（SRS/间隔重复）从"背单词"的具体业务中**完全解耦**，建立一个通用的闪卡核心库：

```
MixRead (back-end API) ──┐
                         ├─→ [通用闪卡核心库] ← 语言学习App
                         ├─→ 历史记忆App
                         └─→ 知识卡片App
```

## 设计原则

### 1. 单一职责：核心库只做三件事

| 层级           | 职责                   | 不涉及           |
| -------------- | ---------------------- | ---------------- |
| **SRS 调度层** | 计算复习时间、难度调整 | 数据如何存储     |
| **会话管理层** | 构建复习队列、追踪进度 | 卡片内容结构     |
| **分析层**     | 统计学习效果、生成报告 | 用户界面、数据库 |

### 2. 接口驱动设计

核心库定义接口而不是具体实现：

```python
# 核心库只定义这些接口
class LearningItem(ABC):
    """任何可学习的条目必须实现"""
    item_id: str
    content: Dict[str, Any]  # 内容（可以是单词、历史人物、公式等）
    status: LearningStatus
    created_at: datetime

class ReviewProvider(ABC):
    """应用端实现具体的审查逻辑"""

    def get_item_by_id(self, item_id: str) -> LearningItem:
        """取得学习条目"""
        pass

    def save_item(self, item: LearningItem) -> None:
        """保存条目"""
        pass

    def get_items_by_status(self, status: LearningStatus) -> List[LearningItem]:
        """取得指定状态的条目"""
        pass
```

## 分层架构

### 第 1 层：核心 SRS 引擎（核心库）

```python
# srs_core/scheduler.py
"""与应用无关的纯SRS算法"""

class SpacedRepetitionEngine:
    """间隔重复引擎 - 完全独立于数据结构"""

    def calculate_interval(
        self,
        current_interval: int,
        quality: int,
        ease_factor: float
    ) -> Tuple[int, float]:
        """
        计算下次复习间隔

        完全纯函数：输入参数 → 输出结果，无副作用

        Args:
            current_interval: 当前间隔（小时）
            quality: 难度评分(0-5)
            ease_factor: 难度因子

        Returns:
            (next_interval, new_ease_factor)
        """
        if quality >= 3:
            # 正确答案逻辑
            new_interval = self._increase_interval(current_interval, ease_factor)
            new_ease = self._adjust_ease_factor(ease_factor, quality, increase=True)
        else:
            # 错误答案逻辑
            new_interval = self.initial_interval
            new_ease = self._adjust_ease_factor(ease_factor, quality, increase=False)

        return new_interval, new_ease

    def _increase_interval(self, current: int, ease: float) -> int:
        """纯函数：计算增长的间隔"""
        return int(current * ease)

    def _adjust_ease_factor(self, ease: float, quality: int, increase: bool) -> float:
        """纯函数：调整难度因子"""
        delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02) if increase else -0.2
        return max(1.3, ease + delta)
```

**特点**：

- 无任何数据库依赖
- 无应用特定逻辑
- 100% 可测试
- 其他项目直接 `import SpacedRepetitionEngine`

### 第 2 层：会话管理（核心库）

```python
# srs_core/session.py
"""会话管理 - 基于回调的设计"""

class ReviewSession:
    """复习会话管理"""

    def __init__(
        self,
        provider: ReviewProvider,  # 应用通过回调提供数据
        scheduler: SpacedRepetitionEngine,
        config: SessionConfig
    ):
        self.provider = provider
        self.scheduler = scheduler
        self.config = config
        self.cards = []
        self.current_index = 0
        self.session_stats = SessionStats()

    def build_session(self, strategy: str = "mixed") -> None:
        """
        构建复习会话

        通过回调获取数据，不知道数据从哪来
        """
        due_items = self.provider.get_items_by_status(LearningStatus.DUE)
        new_items = self.provider.get_items_by_status(LearningStatus.NEW)

        # 按策略组合
        items = self._combine_by_strategy(due_items, new_items, strategy)

        # 将 LearningItem 转换为卡片（不修改原始数据）
        self.cards = [
            ReviewCard(item, self.config.card_factory)
            for item in items
        ]

    def submit_answer(self, quality: int) -> ReviewResult:
        """
        提交答案

        返回审查结果，但不直接修改数据库
        """
        current_card = self.cards[self.current_index]

        # 1. 使用SRS引擎计算新参数
        new_interval, new_ease = self.scheduler.calculate_interval(
            current_card.item.review_interval,
            quality,
            current_card.item.ease_factor
        )

        # 2. 生成结果对象（不修改数据库）
        result = ReviewResult(
            item_id=current_card.item.item_id,
            quality=quality,
            new_interval=new_interval,
            new_ease=new_ease,
            next_review_time=datetime.now() + timedelta(hours=new_interval)
        )

        # 3. 让应用决定是否保存
        self.provider.save_review_result(result)

        # 4. 更新会话统计
        self.session_stats.record_answer(quality)

        return result

    def next_card(self) -> Optional[ReviewCard]:
        """获取下一张卡片"""
        self.current_index += 1
        if self.current_index < len(self.cards):
            return self.cards[self.current_index]
        return None
```

**特点**：

- 会话只通过 `ReviewProvider` 接口获取数据
- 不创建 item，只创建 `ReviewCard` 视图
- 返回 `ReviewResult` 让应用决定如何保存
- 完全无副作用

### 第 3 层：数据适配层（应用端）

```python
# mixread/application/srs_adapter.py
"""MixRead特定的SRS适配 - 连接核心库和应用数据"""

from srs_core.models import ReviewProvider, LearningItem, LearningStatus, ReviewResult
from infrastructure.models import VocabularyEntryModel

class VocabularyReviewProvider(ReviewProvider):
    """将MixRead的Unified VocabularyEntryModel适配到通用ReviewProvider"""

    def __init__(self, vocabulary_repo):
        from infrastructure.repositories import VocabularyRepository
        self.vocabulary_repo = vocabulary_repo

    def get_items_by_status(self, status: LearningStatus, limit: int = 20):
        # 从统一的 vocabulary_entries 表中查询
        if status == LearningStatus.DUE:
            models = self.vocabulary_repo.get_due_for_review(limit=limit)
        elif status == LearningStatus.NEW:
            models = self.vocabulary_repo.get_new_words(limit=limit)
        else:
            models = []

        return [AdaptedVocabularyItem(m) for m in models]

    def __init__(self, vocabulary_repo):
        self.vocabulary_repo = vocabulary_repo

    def get_item_by_id(self, item_id: str) -> LearningItem:
        entry = self.vocabulary_repo.get_by_id(item_id)
        return self._adapt_to_learning_item(entry)

    def get_items_by_status(self, status: LearningStatus) -> List[LearningItem]:
        entries = self.vocabulary_repo.get_by_status(status)
        return [self._adapt_to_learning_item(e) for e in entries]

    def save_review_result(self, result: ReviewResult) -> None:
        """收到核心库的审查结果后，保存到MixRead数据库"""
        entry = self.vocabulary_repo.get_by_id(result.item_id)

        # 应用自己的业务逻辑
        entry.review_interval = result.new_interval
        entry.ease_factor = result.new_ease
        entry.next_review = result.next_review_time
        entry.total_reviews += 1
        entry.last_review_quality = result.quality

        # 更新状态（这是MixRead特定的）
        if result.quality >= 3:
            entry.correct_reviews += 1
            entry.review_streak += 1
        else:
            entry.review_streak = 0

        # 检查是否掌握
        if entry.review_streak >= 5 and entry.review_interval >= 7 * 24:
            entry.status = VocabularyStatus.MASTERED

        self.vocabulary_repo.update(entry)

        # MixRead特定：记录分析数据
        self.analytics_repo.record_answer(
            user_id=entry.user_id,
            word=entry.word,
            quality=result.quality
        )

    def _adapt_to_learning_item(self, entry: VocabularyEntry) -> LearningItem:
        """适配接口"""
        return AdaptedVocabularyItem(
            item_id=entry.id,
            content={
                "word": entry.word,
                "definition": entry.definition,
                "example": entry.example,
                "cefr": entry.cefr_level
            },
            status=entry.status,
            review_interval=entry.review_interval,
            ease_factor=entry.ease_factor,
            created_at=entry.added_at
        )
```

### 第 4 层：API 路由（应用端）

```python
# mixread/api/review.py
"""MixRead的复习API"""

from srs_core.session import ReviewSession, SpacedRepetitionEngine
from vocabulary_review.srs_adapter import VocabularyReviewProvider

@app.post("/users/{user_id}/review/session")
async def start_review_session(user_id: str, session_type: str = "mixed"):
    """启动复习会话"""

    provider = VocabularyReviewProvider(vocabulary_repo)
    engine = SpacedRepetitionEngine()

    session = ReviewSession(
        provider=provider,
        scheduler=engine,
        config=SessionConfig(card_factory=VocabularyCardFactory)
    )

    session.build_session(session_type)

    # 存储会话到内存或Redis
    session_store.save(session_id, session)

    return {
        "session_id": session_id,
        "total_cards": len(session.cards),
        "first_card": session.cards[0].to_dict()
    }

@app.post("/users/{user_id}/review/answer")
async def submit_answer(user_id: str, session_id: str, quality: int):
    """提交答案"""

    session = session_store.get(session_id)
    result = session.submit_answer(quality)

    next_card = session.next_card()

    return {
        "result": result.to_dict(),
        "next_card": next_card.to_dict() if next_card else None,
        "progress": session.get_progress()
    }
```

## 跨项目复用示意

### 项目 A：MixRead（背单词）

```python
# mixread/srs_adapter.py
class VocabularyReviewProvider(ReviewProvider):
    def get_item_by_id(self, item_id):
        return vocabulary_repo.get(item_id)

    def save_review_result(self, result):
        entry = vocabulary_repo.get(result.item_id)
        entry.next_review = result.next_review_time
        # MixRead特定逻辑...
        vocabulary_repo.update(entry)
```

### 项目 B：HistoryApp（历史人物记忆）

```python
# history_app/srs_adapter.py
class HistoryEventReviewProvider(ReviewProvider):
    def get_item_by_id(self, item_id):
        return history_event_repo.get(item_id)

    def save_review_result(self, result):
        event = history_event_repo.get(result.item_id)
        event.next_review = result.next_review_time
        # HistoryApp特定逻辑...
        history_event_repo.update(event)
```

### 项目 C：FormulaApp（公式记忆）

```python
# formula_app/srs_adapter.py
class FormulaReviewProvider(ReviewProvider):
    def get_item_by_id(self, item_id):
        return formula_repo.get(item_id)

    def save_review_result(self, result):
        formula = formula_repo.get(result.item_id)
        formula.next_review = result.next_review_time
        # FormulaApp特定逻辑...
        formula_repo.update(formula)
```

## 代码组织结构

```
mixread/
├── backend/
│   ├── srs_core/                    # 核心库（可独立发布）
│   │   ├── __init__.py
│   │   ├── scheduler.py             # SpacedRepetitionEngine
│   │   ├── session.py               # ReviewSession
│   │   ├── models.py                # 接口定义
│   │   ├── analytics.py             # 通用分析
│   │   └── tests/                   # 核心库测试
│   │       ├── test_scheduler.py
│   │       └── test_session.py
│   │
│   ├── vocabulary_review/           # MixRead特定实现
│   │   ├── srs_adapter.py          # 适配层
│   │   ├── card_factory.py         # 卡片生成工厂
│   │   ├── api.py                  # API端点
│   │   └── tests/
│   │
│   ├── domain/
│   │   └── models.py               # VocabularyEntry
│   │
│   └── infrastructure/
│       └── repositories.py         # 数据库访问
│
└── README.md
```

## 核心库的发布和版本管理

### 选项 1：Python 包

```bash
# srs_core/setup.py
from setuptools import setup

setup(
    name='srs-core',
    version='1.0.0',
    packages=['srs_core'],
    description='通用间隔重复系统核心库',
    author='Your Name',
    python_requires='>=3.8'
)

# 在其他项目中使用
pip install git+https://github.com/yourname/srs-core.git
```

### 选项 2：Monorepo 方式

```
root/
├── libs/
│   └── srs_core/                  # 共享库
│       ├── scheduler.py
│       └── tests/
├── projects/
│   ├── mixread/                   # MixRead项目
│   │   └── vocabulary_review/
│   ├── history_app/               # 历史App项目
│   │   └── event_review/
│   └── formula_app/               # 公式App项目
│       └── formula_review/
└── pyproject.toml                 # monorepo配置
```

## 测试策略

### 1. 核心库测试（独立，无外部依赖）

```python
# srs_core/tests/test_scheduler.py
def test_sm2_algorithm():
    engine = SpacedRepetitionEngine()

    # 第一次回顾
    interval, ease = engine.calculate_interval(0, 5, 2.5)
    assert interval == 6  # 6小时

    # 第二次回顾
    interval, ease = engine.calculate_interval(6, 4, 2.5)
    assert interval == 15  # 应增加

    # 错误回顾
    interval, ease = engine.calculate_interval(15, 1, 2.5)
    assert interval == 1  # 重置

def test_session_no_side_effects():
    """会话不应该修改原始数据"""
    mock_provider = MockReviewProvider()
    session = ReviewSession(mock_provider, SpacedRepetitionEngine(), {})

    session.build_session()
    session.submit_answer(5)

    # 验证provider只被调用，未被修改
    assert mock_provider.get_items_called > 0
    assert mock_provider.save_called == 0  # 会话不保存
```

### 2. 适配层测试（集成测试）

```python
# mixread/tests/test_srs_adapter.py
def test_vocabulary_provider_integration():
    """测试MixRead适配层"""
    adapter = VocabularyReviewProvider(vocabulary_repo)

    result = ReviewResult(
        item_id='word_1',
        quality=5,
        new_interval=24,
        new_ease=2.6,
        next_review_time=datetime.now() + timedelta(hours=24)
    )

    adapter.save_review_result(result)

    # 验证数据库被正确更新
    entry = vocabulary_repo.get('word_1')
    assert entry.next_review.day == (datetime.now() + timedelta(hours=24)).day
    assert entry.ease_factor == 2.6
```

## 与现有文档的关系

| 文档                           | 作用                              |
| ------------------------------ | --------------------------------- |
| **README.md**                  | 面向 MixRead 的使用文档（业务层） |
| **ARCHITECTURE.md**            | 本文档，面向可复用性的架构设计    |
| **IMPLEMENTATION.md** （可选） | 具体实现细节和 API 参考           |

## 总结

这个设计的关键优势：

| 方面         | 好处                                       |
| ------------ | ------------------------------------------ |
| **解耦**     | 核心库与业务无关，可直接复用               |
| **可测试性** | 核心库是纯函数，易于单测                   |
| **灵活性**   | 应用可自定义业务逻辑，不修改核心库         |
| **扩展性**   | 新项目只需实现 `ReviewProvider` 接口       |
| **维护性**   | 修复 SRS 算法 bug 只需改一处，所有项目受益 |
| **性能**     | 会话基于回调，支持流式处理，无批量加载     |

核心原则：**核心库只管"学习算法"，不管"数据怎么存"，应用决定"业务怎么做"**
