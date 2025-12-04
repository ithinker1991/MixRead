# 设计决策：记忆系统与背单词业务的解耦

## 背景问题

> "单词记忆这个模块的设计最好和背单词这个事情解耦开，通过前期设计就可以，因为后续打算做一个闪卡类型app，但不限于只是单词，希望能够复用这个模块的代码"

这个文档记录**为什么**和**如何**解耦的设计决策。

---

## 核心答案

### 设计目标

```
MixRead（背单词）
     ↓
  [通用SRS核心库]  ← 可被任何闪卡应用复用
     ↑
未来的闪卡App（历史、���式、医学术语、etc）
```

**一个核心库，三个应用**：
- MixRead：背英文单词
- HistoryApp：记忆历史事件
- FormulaApp：记忆数学公式

**改进前的问题**：
```
❌ MixRead特定代码混在一起
  - VocabularyEntry 与 SRS算法耦合
  - 数据库逻辑 与 间隔重复算法混合
  - 难以被其他项目复用
```

**改��后的结构**：
```
✅ 完全解耦的分层架构
  ┌─────────────────────────────┐
  │  应用层（MixRead特定逻辑）    │ ← 背单词业务、UI、数据库
  ├─────────────────────────────┤
  │  适配层（ReviewProvider）     │ ← 连接应用 ↔ 核心库
  ├─────────────────────────────┤
  │  核心库（SRS+Session）        │ ← 纯算法，任何项目可用
  └─────────────────────────────┘
```

---

## 如何做到解耦

### 1. 核心库只定义接口，不实现业务

**错误做法**（耦合）：
```python
class SpacedRepetitionEngine:
    def calculate_interval(self, vocabulary_entry):  # ❌ 耦合到VocabularyEntry
        # ...
        vocabulary_entry.next_review = datetime.now()  # ❌ 直接修改数据
        database.save(vocabulary_entry)                 # ❌ 知道怎么存储
```

**正确做法**（解耦）：
```python
class SpacedRepetitionEngine:
    def calculate_interval(
        self,
        current_interval: int,    # ✅ 纯数据
        quality: int,             # ✅ 纯数据
        ease_factor: float        # ✅ 纯数据
    ) -> Tuple[int, float]:
        # ✅ 纯函数：输入 → 计算 → 输出
        # ✅ 无副作用，无数据库调用
        return new_interval, new_ease_factor
```

**关键原则**：
- 输入基本数据类型 (int, float, str)
- 返回基本数据类型
- 不知道调用方是谁
- 不知道数据怎么存储
- 不知道运行在什么框架上

---

### 2. 会话层通过回调获取数据

**错误做法**（耦合）：
```python
class ReviewSession:
    def __init__(self, user_id):
        self.user_id = user_id
        # ❌ 直接依赖数据库
        self.vocabulary_repo = VocabularyRepository()

    def build_session(self):
        # ❌ 只能用MixRead的VocabularyEntry
        items = self.vocabulary_repo.get_by_status("LEARNING")
```

**正确做法**（解耦）：
```python
class ReviewSession:
    def __init__(self, provider: ReviewProvider):
        self.provider = provider  # ✅ 接口，不是具体实现

    def build_session(self):
        # ✅ 不知道provider从哪来，怎么实现的
        items = self.provider.get_items_by_status(LearningStatus.LEARNING)
```

**关键原则**：
- 依赖接口（抽象），不依赖实现（具体）
- 应用通过实现接口来提供数据
- 会话层完全不知道应用的存在

---

### 3. 适配层连接应用和核心库

**MixRead实现**：
```python
class VocabularyReviewProvider(ReviewProvider):  # ✅ 实现接口
    def __init__(self, vocabulary_repo):
        self.vocabulary_repo = vocabulary_repo

    def get_items_by_status(self, status):
        # MixRead特定逻辑：从数据库查询VocabularyEntry
        entries = self.vocabulary_repo.get_by_status(status)
        # 适配为通用的LearningItem
        return [AdaptedVocabularyItem(e) for e in entries]

    def save_review_result(self, result):
        # MixRead特定逻辑：更新数据库
        entry = self.vocabulary_repo.get_by_id(result.item_id)
        entry.next_review = result.next_review_time
        # 其他MixRead特定字段...
        self.vocabulary_repo.update(entry)
```

**未来应用实现**（只需改适配层，核心库无改）：
```python
# 历史App
class HistoryEventReviewProvider(ReviewProvider):
    def get_items_by_status(self, status):
        events = self.history_repo.get_by_status(status)
        return [AdaptedHistoryItem(e) for e in events]

    def save_review_result(self, result):
        event = self.history_repo.get_by_id(result.item_id)
        event.next_review = result.next_review_time
        self.history_repo.update(event)

# 公式App
class FormulaReviewProvider(ReviewProvider):
    def get_items_by_status(self, status):
        formulas = self.formula_repo.get_by_status(status)
        return [AdaptedFormulaItem(e) for e in formulas]

    def save_review_result(self, result):
        formula = self.formula_repo.get_by_id(result.item_id)
        formula.next_review = result.next_review_time
        self.formula_repo.update(formula)
```

**关键原则**：
- 核心库完全不变
- 只需写新应用的适配层
- 复用核心库的SRS和会话逻辑

---

## 具体实现对比

### 场景1：为MixRead实现复习功能

**需要做的事**：
```
1. 核心库 (srs_core/)
   ├─ scheduler.py      ← SpacedRepetitionEngine（纯算法）
   ├─ session.py        ← ReviewSession（会话管理）
   └─ models.py         ← ReviewProvider接口

2. MixRead适配层 (vocabulary_review/)
   ├─ adapter.py        ← VocabularyReviewProvider实现
   └─ api.py            ← REST API端点

3. MixRead前端
   └─ review.js         ← UI和交互

投入：8-10小时
```

### 场景2：为未来应用复用SRS

**只需做的事**：
```
1. 新应用的适配层（参考MixRead的adapter.py）
   ├─ adapter.py        ← NewAppReviewProvider实现
   └─ api.py            ← REST API端点

2. 新应用前端
   └─ review.js         ← UI和交互

投入：2-3小时（核心库完全复用，只改数据源）
```

**对比**：
- 第一个应用：8-10小时（包括核心库设计）
- 后续应用：每个2-3小时（核心库复用，只改适配层）

---

## 技术细节对比

### 解耦前 vs 解耦后

| 方面 | 解耦前 ❌ | 解耦后 ✅ |
|------|---------|---------|
| **核心库大小** | N/A | ~200行代码（纯函数） |
| **MixRead实现** | 一坨代码混在一起 | 清晰的3层分离 |
| **复用到新应用** | 需要大规模重构 | 复制适配层即可 |
| **修复SRS bug** | 找不到哪里出错 | 改核心库，所有应用受益 |
| **单元测试** | 依赖数据库，慢 | 纯函数测试，快 |
| **易读性** | 混乱 | 清晰的职责划分 |

---

## 代码示例对比

### 解耦前：混乱（不推荐）

```python
# ❌ 所有逻辑混在一个类里
class VocabularyEntry:
    # 数据...
    word: str
    next_review: datetime
    ease_factor: float

    def calculate_next_review(self, quality):
        """这个方法既改对象本身，又不能复用"""
        # 算法逻辑
        if quality >= 3:
            self.review_interval = int(self.review_interval * self.ease_factor)
        else:
            self.review_interval = 1

        # 数据库操作
        db.update(self)

        # 业务逻辑
        if self.review_interval > 7*24:
            self.status = "MASTERED"

# ❌ 每个应用都要复制这个类并修改
class HistoryEvent:
    event: str
    next_review: datetime
    ease_factor: float

    def calculate_next_review(self, quality):
        """复制粘贴，无法共享"""
        # 相同的算法...（重复代码）
        # 不同的字段...
        if self.review_interval > 14*24:  # HistoryApp用14天
            self.status = "MASTERED"
```

### 解耦后：清晰（推荐）

```python
# ✅ 核心库：纯函数，不知道是谁调用
class SpacedRepetitionEngine:
    def calculate_interval(self, current_interval, quality, ease_factor):
        """返回数据，让调用方决定怎么存"""
        if quality >= 3:
            new_interval = int(current_interval * ease_factor)
        else:
            new_interval = 1
        return new_interval, ease_factor

# ✅ MixRead适配层：连接MixRead → 核心库
class VocabularyReviewProvider(ReviewProvider):
    def __init__(self, repo):
        self.repo = repo

    def save_review_result(self, result):
        entry = self.repo.get(result.item_id)
        entry.next_review = result.next_review_time

        # MixRead特定逻辑
        if result.new_interval > 7*24:
            entry.status = "MASTERED"

        self.repo.update(entry)

# ✅ HistoryApp适配层：改一个方法，核心库不变
class HistoryEventReviewProvider(ReviewProvider):
    def __init__(self, repo):
        self.repo = repo

    def save_review_result(self, result):
        event = self.repo.get(result.item_id)
        event.next_review = result.next_review_time

        # HistoryApp特定逻辑（不同的阈值）
        if result.new_interval > 14*24:
            event.status = "MASTERED"

        self.repo.update(event)

# ✅ 核心库和会话逻辑完全复用，0行重复代码
```

---

## 架构图

### 微观：类和接口的关系

```
┌─────────────────────────────────────────┐
│         ReviewProvider (接口)            │
│                                          │
│ + get_items_by_status()                 │
│ + save_review_result()                  │
└──────────────────┬──────────────────────┘
                   │ 实现
        ┌──────────┴──────────┬────────────┐
        │                     │            │
   ┌────▼────────┐   ┌───────▼──┐   ┌────▼────────┐
   │Vocabulary   │   │ History  │   │ Formula     │
   │Review       │   │Event     │   │Review       │
   │Provider     │   │Review    │   │Provider     │
   │             │   │Provider  │   │             │
   │(MixRead)    │   │(future)  │   │(future)     │
   └─────────────┘   └──────────┘   └─────────────┘
```

### 宏观：应用分层

```
┌─────────────────────────────────────────────────────┐
│           各应用（MixRead，HistoryApp等）           │
│  • UI和交互逻辑                                     │
│  • 业务规则（如掌握标准）                           │
│  • 数据库模型                                       │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│          适配层（ReviewProvider实现）               │
│  • 连接应用数据 ↔ 通用接口                          │
│  • 转换数据格式                                     │
│  • 处理业务特定的副作用                              │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│        核心库（完全独立，可复用）                    │
│  • SpacedRepetitionEngine (纯算法)                   │
│  • ReviewSession (会话管理)                         │
│  • Models (接口定义)                                │
│  0行应用特定代码                                    │
└─────────────────────────────────────────────────────┘
```

---

## 时间投入对比

### 方案A：不解耦（快速但难维护）

```
MixRead实现：   8小时  ✅
未来应用1：     10小时 （需要大规模重构）
未来应用2：     10小时 （需要大规模重构）
未来应用3：     10小时 （需要大规模重构）
─────────────────────
总计：          38小时

维护：         复杂（改一处影响多处）
新应用学习成本： 高
```

### 方案B：解耦（初期多花一点，后期省很多）

```
核心库设计：     3小时  ✅
MixRead实现：    7小时  ✅
未来应用1：      2小时  ✅ （只改适配层）
未来应用2：      2小时  ✅
未来应用3：      2小时  ✅
─────────────────────
总计：          16小时

维护：         简单（核心库独立）
新应用学习成本： 低（模板化）
```

**节省**：38 - 16 = **22小时**

---

## 质量保证

### 解耦带来的测试优势

| 测试类型 | 解耦前 | 解耦后 |
|---------|--------|--------|
| **核心算法单测** | 依赖数据库，慢 | 纯函数，秒级 |
| **集成测试** | 复杂setup | 简单mock |
| **回归测试** | 不敢改 | 有信心改 |
| **跨应用验证** | 每个应用都测 | 核心库测一次 |

**具体例子**：

```python
# ✅ 解耦后：核心库测试超快
def test_sm2_algorithm():
    engine = SpacedRepetitionEngine()
    interval, ease = engine.calculate_interval(6, 5, 2.5)
    assert interval == 15
    # 3毫秒运行完成，无数据库依赖

# ❌ 解耦前：测试慢且脆弱
def test_vocabulary_review():
    entry = VocabularyEntry(word="hello")
    db.save(entry)  # 需要测试数据库
    entry.calculate_next_review(5)
    db.verify_updated(entry)  # 需要验证数据库
    # 3秒运行完成，依赖数据库状态
```

---

## 实施建议

### 立即行动

1. **立即开始**（这次）
   - 基于ARCHITECTURE.md设计核心库接口
   - 实现QUICK_START.md中的第一步：SpacedRepetitionEngine

2. **第二周**
   - 实现QUICK_START.md的第二步：MixRead适配层
   - 完成第一个MVP（基础闪卡功能）

3. **第三周**
   - 测试和优化
   - 用户验证

### 未来项目

- **HistoryApp**：参考MixRead的adapter.py，改数据源，2小时搞定
- **FormulaApp**：同上，2小时搞定
- **新应用**：同上，2小时搞定

---

## 总结

### 关键决策

| 决策 | 原因 |
|------|------|
| **将SRS核心库独立** | 不含任何应用特定代码，可复用 |
| **通过接口通讯** | 核心库对调用者无依赖 |
| **适配层模式** | 新应用只需实现ReviewProvider |
| **纯函数设计** | 易测试、易维护、易理解 |

### 设计收益

✅ **第一个应用**：8-10小时完成（包括核心库设计）
✅ **后续应用**：2小时/个（核心库复用）
✅ **维护**：修复一次，所有应用受益
✅ **质量**：核心库100%覆盖测试
✅ **学习**：新开发者一个文件搞懂（不是N个混乱的文件）

---

**设计制定日期**：2025-12-04
**参考文档**：ARCHITECTURE.md, QUICK_START.md