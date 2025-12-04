# 快速启动：实现第一个复习会话

本文档展示如何基于可复用的 SRS 核心库快速实现 MixRead 的复习功能。

## 第一步：实现核心库接口（2 小时）

### 1.1 定义通用接口

```python
# backend/srs_core/models.py
from abc import ABC, abstractmethod
from enum import Enum
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

class LearningStatus(Enum):
    """学习条目的状态"""
    NEW = "new"              # 新词
    LEARNING = "learning"    # 学习中
    REVIEWING = "reviewing"  # 复习中
    DUE = "due"             # 需要复习
    MASTERED = "mastered"   # 已掌握

class LearningItem(ABC):
    """任何可学习条目的接口"""
    item_id: str
    content: Dict[str, Any]
    status: LearningStatus
    review_interval: int        # 小时
    ease_factor: float          # 难度因子
    created_at: datetime

    @abstractmethod
    def to_dict(self) -> Dict:
        pass

class ReviewProvider(ABC):
    """应用端实现此接口来提供数据"""

    @abstractmethod
    def get_item_by_id(self, item_id: str) -> Optional[LearningItem]:
        """获取单个学习条目"""
        pass

    @abstractmethod
    def get_items_by_status(self, status: LearningStatus, limit: int = 20) -> List[LearningItem]:
        """获取指定状态的条目列表"""
        pass

    @abstractmethod
    def save_review_result(self, result: 'ReviewResult') -> None:
        """保存审查结果"""
        pass

class ReviewResult:
    """审查结果数据对象"""
    def __init__(
        self,
        item_id: str,
        quality: int,
        new_interval: int,
        new_ease: float,
        next_review_time: datetime
    ):
        self.item_id = item_id
        self.quality = quality
        self.new_interval = new_interval
        self.new_ease = new_ease
        self.next_review_time = next_review_time

    def to_dict(self) -> Dict:
        return {
            "item_id": self.item_id,
            "quality": self.quality,
            "new_interval": self.new_interval,
            "new_ease": self.new_ease,
            "next_review_time": self.next_review_time.isoformat()
        }
```

### 1.2 实现 SRS 调度器

```python
# backend/srs_core/scheduler.py
from datetime import datetime, timedelta
from typing import Tuple

class SpacedRepetitionEngine:
    """
    间隔重复引擎 - 纯函数，无任何副作用

    基于SM-2算法，完全独立于应用和数据库
    """

    def __init__(self):
        self.initial_interval = 1    # 首次复习1小时后
        self.min_ease_factor = 1.3
        self.initial_ease = 2.5

    def calculate_interval(
        self,
        current_interval: int,
        quality: int,
        ease_factor: float,
        review_count: int = 1
    ) -> Tuple[int, float]:
        """
        计算下次复习间隔和新的难度因子

        Args:
            current_interval: 当前复习间隔（小时）
            quality: 用户评分(0-5)
            ease_factor: 当前难度因子
            review_count: 已复习次数

        Returns:
            (next_interval, new_ease_factor)

        质量评分含义:
            0: 完全忘记
            1: 错误但有印象
            2: 错误但容易想起
            3: 正确但需要思考
            4: 正确且轻松
            5: 完美记忆
        """

        # 计算新的难度因子
        new_ease = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        new_ease = max(self.min_ease_factor, new_ease)

        # 计算新的间隔
        if quality < 3:
            # 错误答案：重置
            next_interval = self.initial_interval
        else:
            # 正确答案：增加间隔
            if review_count == 1:
                next_interval = 1      # 1天
            elif review_count == 2:
                next_interval = 3      # 3天
            else:
                # 第3次及以后：乘以难度因子
                next_interval = int(current_interval * new_ease)

        return next_interval * 24, new_ease  # 转换为小时

    def get_next_review_time(self, interval_hours: int) -> datetime:
        """计算下次复习的绝对时间"""
        return datetime.now() + timedelta(hours=interval_hours)
```

### 1.3 会话管理

```python
# backend/srs_core/session.py
from typing import List, Optional
from .models import ReviewProvider, LearningItem, ReviewResult, LearningStatus
from .scheduler import SpacedRepetitionEngine

class ReviewCard:
    """复习卡片 - 为LearningItem创建的视图"""
    def __init__(self, item: LearningItem):
        self.item = item

    def to_dict(self):
        return {
            "id": self.item.item_id,
            "front": self.item.content.get("word"),  # 正面：单词
            "back": {
                "definition": self.item.content.get("definition"),
                "example": self.item.content.get("example"),
                "cefr": self.item.content.get("cefr")
            }
        }

class ReviewSession:
    """复习会话管理"""

    def __init__(self, provider: ReviewProvider, config: dict = None):
        self.provider = provider
        self.scheduler = SpacedRepetitionEngine()
        self.config = config or {}
        self.cards: List[ReviewCard] = []
        self.current_index = 0
        self.session_id = None

        # 统计数据
        self.stats = {
            "total_cards": 0,
            "cards_reviewed": 0,
            "correct_count": 0,
            "streak": 0,
            "quality_dist": {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            "start_time": datetime.now()
        }

    def build_session(self, strategy: str = "mixed", limit: int = 20) -> bool:
        """
        构建复习会话

        Args:
            strategy: "new"(仅新词), "review"(仅复习), "mixed"(混合)
            limit: 单个类别的最大条目数

        Returns:
            是否成功构建
        """
        items = []

        # 获取到期复习的条目
        if strategy in ["review", "mixed"]:
            due_items = self.provider.get_items_by_status(LearningStatus.DUE, limit)
            items.extend(due_items)

        # 获取新条目
        if strategy in ["new", "mixed"]:
            new_items = self.provider.get_items_by_status(LearningStatus.NEW, limit // 2)
            items.extend(new_items)

        if not items:
            return False

        # 创建卡片
        self.cards = [ReviewCard(item) for item in items]
        self.stats["total_cards"] = len(self.cards)

        return True

    def get_current_card(self) -> Optional[ReviewCard]:
        """获取当前卡片"""
        if 0 <= self.current_index < len(self.cards):
            return self.cards[self.current_index]
        return None

    def submit_answer(self, quality: int) -> Optional[ReviewResult]:
        """
        提交答案

        Args:
            quality: 难度评分(0-5)

        Returns:
            审查结果或None
        """
        if not (0 <= quality <= 5):
            raise ValueError("Quality must be 0-5")

        current_card = self.get_current_card()
        if not current_card:
            return None

        item = current_card.item

        # 1. 使用SRS引擎计算
        next_interval, new_ease = self.scheduler.calculate_interval(
            current_interval=item.review_interval,
            quality=quality,
            ease_factor=item.ease_factor,
            review_count=item.review_count if hasattr(item, 'review_count') else 1
        )

        # 2. 生成结果
        result = ReviewResult(
            item_id=item.item_id,
            quality=quality,
            new_interval=next_interval,
            new_ease=new_ease,
            next_review_time=self.scheduler.get_next_review_time(next_interval)
        )

        # 3. 保存结果（由应用实现细节）
        self.provider.save_review_result(result)

        # 4. 更新会话统计
        self.stats["cards_reviewed"] += 1
        self.stats["quality_dist"][quality] += 1

        if quality >= 3:
            self.stats["correct_count"] += 1
            self.stats["streak"] += 1
        else:
            self.stats["streak"] = 0

        return result

    def next_card(self) -> Optional[ReviewCard]:
        """移动到下一张卡片"""
        self.current_index += 1
        return self.get_current_card()

    def is_session_complete(self) -> bool:
        """会话是否完成"""
        return self.current_index >= len(self.cards)

    def get_progress(self) -> dict:
        """获取会话进度"""
        return {
            "current": self.current_index + 1,
            "total": self.stats["total_cards"],
            "percentage": (self.current_index + 1) / max(1, self.stats["total_cards"]) * 100,
            "correct": self.stats["correct_count"],
            "accuracy": self.stats["correct_count"] / max(1, self.stats["cards_reviewed"])
        }

    def end_session(self) -> dict:
        """结束会话并返回总体统计"""
        duration = (datetime.now() - self.stats["start_time"]).total_seconds() / 60

        return {
            "total_reviewed": self.stats["cards_reviewed"],
            "correct_count": self.stats["correct_count"],
            "accuracy": self.stats["correct_count"] / max(1, self.stats["cards_reviewed"]),
            "duration_minutes": duration,
            "quality_distribution": self.stats["quality_dist"],
            "max_streak": self.stats["streak"]
        }
```

## 第二步：实现 MixRead 适配层（1 小时）

```python
# backend/vocabulary_review/adapter.py
from datetime import datetime, timedelta
from srs_core.models import LearningItem, ReviewProvider, LearningStatus, ReviewResult
from domain.models import VocabularyEntry, VocabularyStatus
from infrastructure.repositories import VocabularyRepository

class AdaptedVocabularyItem(LearningItem):
    """VocabularyEntry适配为LearningItem"""

    def __init__(self, entry: VocabularyEntry):
        self.entry = entry
        self.item_id = entry.id
        self.status = self._map_status(entry.status)
        self.review_interval = entry.review_interval
        self.ease_factor = entry.ease_factor
        self.created_at = entry.added_at
        self.content = {
            "word": entry.word,
            "definition": entry.definition,
            "example": entry.example,
            "cefr": entry.cefr_level,
            "pronunciation": entry.pronunciation
        }
        self.review_count = entry.total_reviews

    def _map_status(self, vocab_status: VocabularyStatus) -> LearningStatus:
        """将MixRead状态映射到通用状态"""
        mapping = {
            VocabularyStatus.NEW: LearningStatus.NEW,
            VocabularyStatus.LEARNING: LearningStatus.LEARNING,
            VocabularyStatus.REVIEWING: LearningStatus.REVIEWING,
            VocabularyStatus.MASTERED: LearningStatus.MASTERED
        }
        return mapping.get(vocab_status, LearningStatus.NEW)

    def to_dict(self):
        return {
            "item_id": self.item_id,
            "word": self.content["word"],
            "definition": self.content["definition"],
            "example": self.content["example"],
            "cefr": self.content["cefr"],
            "status": self.status.value
        }

class VocabularyReviewProvider(ReviewProvider):
    """MixRead的复习提供者"""

    def __init__(self, vocabulary_repo: VocabularyRepository, analytics_repo=None):
        self.vocabulary_repo = vocabulary_repo
        self.analytics_repo = analytics_repo

    def get_item_by_id(self, item_id: str) -> LearningItem:
        entry = self.vocabulary_repo.get_by_id(item_id)
        if not entry:
            raise ValueError(f"Vocabulary entry {item_id} not found")
        return AdaptedVocabularyItem(entry)

    def get_items_by_status(self, status: LearningStatus, limit: int = 20) -> List[LearningItem]:
        """获取指定状态的条目"""

        if status == LearningStatus.DUE:
            # 获取到期的条目（next_review <= now）
            entries = self.vocabulary_repo.get_due_for_review(
                datetime.now(),
                limit
            )
        elif status == LearningStatus.NEW:
            # 获取新词（今天的新词有限制）
            entries = self.vocabulary_repo.get_new_words(limit)
        else:
            # 其他状态
            vocab_status = {
                LearningStatus.LEARNING: VocabularyStatus.LEARNING,
                LearningStatus.REVIEWING: VocabularyStatus.REVIEWING,
                LearningStatus.MASTERED: VocabularyStatus.MASTERED,
            }.get(status)

            if vocab_status:
                entries = self.vocabulary_repo.get_by_status(vocab_status, limit)
            else:
                entries = []

        return [AdaptedVocabularyItem(e) for e in entries]

    def save_review_result(self, result: ReviewResult) -> None:
        """保存审查结果到数据库"""

        # 1. 获取原始条目
        entry = self.vocabulary_repo.get_by_id(result.item_id)
        if not entry:
            return

        # 2. 更新SRS相关字段
        entry.review_interval = result.new_interval
        entry.ease_factor = result.new_ease
        entry.next_review = result.next_review_time
        entry.last_reviewed = datetime.now()
        entry.total_reviews += 1
        entry.last_review_quality = result.quality

        # 3. 更新MixRead特定的业务字段
        if result.quality >= 3:
            entry.correct_reviews += 1
            entry.review_streak += 1
        else:
            entry.review_streak = 0

        # 4. 检查是否掌握（MixRead的业务规则）
        if (entry.review_streak >= 5 and
            entry.review_interval >= 7 * 24):  # 7天
            entry.status = VocabularyStatus.MASTERED
        elif entry.total_reviews > 0:
            entry.status = VocabularyStatus.REVIEWING
        else:
            entry.status = VocabularyStatus.LEARNING

        # 5. 保存到数据库
        self.vocabulary_repo.update(entry)

        # 6. 记录分析数据（可选）
        if self.analytics_repo:
            self.analytics_repo.record_answer(
                user_id=entry.user_id,
                word=entry.word,
                quality=result.quality,
                response_time=0,  # 如需追踪可从前端传入
                interval=result.new_interval
            )
```

## 第三步：API 端点（1 小时）

```python
# backend/vocabulary_review/api.py
from fastapi import APIRouter, HTTPException
from srs_core.session import ReviewSession
from .adapter import VocabularyReviewProvider
from infrastructure.repositories import VocabularyRepository

router = APIRouter(prefix="/users/{user_id}/review", tags=["review"])
# ⚠️ 注意：这里使用内存存储仅用于演示/MVP
# 生产环境必须使用 Redis 或数据库，否则服务重启后会话将丢失
session_store = {}

@router.post("/session")
async def start_review_session(user_id: str, session_type: str = "mixed"):
    """
    启动复习会话

    Args:
        user_id: 用户ID
        session_type: "new"|"review"|"mixed"

    Returns:
        session_id和第一张卡片
    """

    try:
        # 1. 创建提供者
        provider = VocabularyReviewProvider(VocabularyRepository())

        # 2. 创建会话
        session = ReviewSession(provider)

        # 3. 构建会话
        if not session.build_session(strategy=session_type, limit=20):
            raise HTTPException(status_code=204, detail="No cards available")

        # 4. 保存会话
        from uuid import uuid4
        session_id = str(uuid4())
        session_store[session_id] = session

        # 5. 返回第一张卡片
        first_card = session.get_current_card()

        return {
            "success": True,
            "session_id": session_id,
            "total_cards": session.stats["total_cards"],
            "first_card": first_card.to_dict(),
            "progress": session.get_progress()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/answer")
async def submit_answer(user_id: str, session_id: str, quality: int):
    """
    提交答案

    Args:
        user_id: 用户ID
        session_id: 会话ID
        quality: 难度评分(0-5)

    Returns:
        审查结果和下一张卡片
    """

    if session_id not in session_store:
        raise HTTPException(status_code=404, detail="Session not found")

    session = session_store[session_id]

    try:
        # 1. 提交答案
        result = session.submit_answer(quality)

        if not result:
            raise HTTPException(status_code=400, detail="Invalid card index")

        # 2. 获取下一张卡片
        next_card = session.next_card()

        # 3. 检查会话是否完成
        if session.is_session_complete():
            # 清理会话
            session_summary = session.end_session()
            del session_store[session_id]

            return {
                "success": True,
                "result": result.to_dict(),
                "session_complete": True,
                "session_summary": session_summary
            }

        # 4. 返回下一张卡片
        return {
            "success": True,
            "result": result.to_dict(),
            "next_card": next_card.to_dict() if next_card else None,
            "progress": session.get_progress(),
            "session_complete": False
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_review_stats(user_id: str, period: str = "week"):
    """获取用户的复习统计"""
    # 实现复习统计逻辑
    pass
```

## 第四步：前端集成（2 小时）

```javascript
// frontend/modules/review/review-manager.js
class ReviewManager {
  constructor(userId) {
    this.userId = userId;
    this.sessionId = localStorage.getItem(`review_session_${userId}`);
    this.session = null;
    this.cardIndex = 0;
    this.isSubmitting = false; // 防止重复提交
  }

  async startSession(sessionType = "mixed") {
    try {
      const response = await fetch(`/users/${this.userId}/review/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_type: sessionType }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to start session");
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to start session");
      }

      this.sessionId = data.session_id;
      // 持久化 session ID，防止弹窗关闭后丢失
      localStorage.setItem(`review_session_${this.userId}`, this.sessionId);

      this.session = data;

      this.displayCard(data.first_card);
      this.updateProgress(data.progress);

      return this.session;
    } catch (error) {
      console.error("Failed to start review session:", error);
      throw error;
    }
  }

  async submitAnswer(quality) {
    if (!this.sessionId) {
      // 尝试恢复会话
      this.sessionId = localStorage.getItem(`review_session_${this.userId}`);
      if (!this.sessionId) {
        throw new Error("No active session");
      }
    }

    if (this.isSubmitting) return; // 防抖
    this.isSubmitting = true;

    try {
      const response = await fetch(`/users/${this.userId}/review/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: this.sessionId,
          quality: quality,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to submit answer");
      }

      // 显示结果
      this.showResult(data.result);

      // 检查是否完成
      if (data.session_complete) {
        this.sessionEnded(data.session_summary);
        return;
      }

      // 显示下一张卡片
      if (data.next_card) {
        this.displayCard(data.next_card);
        this.updateProgress(data.progress);
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
      throw error;
    } finally {
      this.isSubmitting = false;
    }
  }

  displayCard(card) {
    // 更新UI显示卡片
    document.getElementById("word").textContent = card.front;
    document.getElementById("definition").textContent = card.back.definition;
    document.getElementById("example").textContent = card.back.example;
  }

  showResult(result) {
    // 显示反馈
    console.log(
      `Answer recorded: quality=${result.quality}, next_review=${result.next_review_time}`
    );
  }

  updateProgress(progress) {
    document.getElementById("progress-current").textContent = progress.current;
    document.getElementById("progress-total").textContent = progress.total;
    document.getElementById("accuracy").textContent =
      (progress.accuracy * 100).toFixed(0) + "%";
  }

  sessionEnded(summary) {
    console.log("Session ended:", summary);
    // 清理本地存储
    localStorage.removeItem(`review_session_${this.userId}`);
    this.sessionId = null;
    // 显示完成页面
  }
}

// 使用示例
const reviewManager = new ReviewManager("user123");

document
  .getElementById("start-review-btn")
  .addEventListener("click", async () => {
    await reviewManager.startSession("mixed");
  });

document.querySelectorAll(".quality-btn").forEach((btn) => {
  btn.addEventListener("click", async (e) => {
    const quality = parseInt(e.target.dataset.quality);
    await reviewManager.submitAnswer(quality);
  });
});
```

## 测试检查清单

在提交代码前，执行以下检查：

```bash
# 1. 单元测试 - 核心库
pytest backend/srs_core/tests/ -v

# 2. 集成测试 - 适配层
pytest backend/vocabulary_review/tests/ -v

# 3. API测试
pytest backend/tests/test_review_api.py -v

# 4. 后端启动检查
python -m backend.main

# 5. 前端检查（Chrome DevTools）
# - 打开 Chrome DevTools Console
# - 应该没有错误
# - Network标签：API调用成功
# - 卡片正确显示

# 6. 实际测试流程
# - 启动后端
# - 打开Library页面
# - 点击"Start Review"
# - 正常显示和交互
```

## 下一步

1. ✅ 实现核心库（2 小时）
2. ✅ 实现适配层（1 小时）
3. ✅ API 端点（1 小时）
4. ✅ 前端集成（2 小时）
5. ⬜ **运行数据迁移**（重要！参考 README.md 的 Data Migration Strategy）
6. ⬜ 添加测试用例（1 小时）
7. ⬜ 前端美化和 UX 优化（2 小时）
8. ⬜ 文档完善（1 小时）
9. ⬜ 用户测试和迭代（持续）

预计总投入：**8-10 小时完成 MVP**，已包括所有必要的架构设计使其可从其他项目复用。
