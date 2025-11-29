# 高亗逻辑的完整设计

## 核心概念重新整理

### 三个独立的维度

#### 1️⃣ **难度滑块** (Difficulty Slider)
- 范围：A1 → A2 → B1 → B2 → C1 → C2
- 作用：**隐含的"我应该已经认识的词汇"范围**
- 用户可以随时调节
- 默认值：B1（或者从用户上次使用记录）

含义：
```
用户设置B2 = "我预期已经认识 A1, A2, B1, B2 级别的词"
用户设置C1 = "我预期已经认识 A1, A2, B1, B2, C1 级别的词"
```

#### 2️⃣ **已认识列表** (known_words)
- 作用：**用户明确标记为"我确实认识这个词"**
- 应用场景：
  - 用户手动点击"Mark as Known" → 从高亗词中移除
  - 用户在词汇库中标记"我已经掌握了这个词"
- 特点：**覆盖难度规则**
  - 即使word_difficulty >= user_difficulty，如果在known_words中，也不高亗

#### 3️⃣ **未认识列表** (unknown_words) 🆕
- 作用：**用户明确标记为"我不认识这个词"**
- 应用场景：
  - 用户看到一个没有高亗的词，点击"Mark as Not Known"
  - 用户想要主动学某个词，但它的难度低于当前设置
- 特点：**优先级最高**
  - 即使word_difficulty < user_difficulty，如果在unknown_words中，仍然高亗
  - 即使在known_words中，如果也在unknown_words中 → **不在unknown_words中**（两者互斥）

#### 4️⃣ **词汇库** (vocabulary) - 学习维度
- 作用：**用户想要学的词汇（用于闪卡）**
- 与高亗逻辑**完全独立**
- 用户可以从任何来源添加：
  - 从高亗词中"Add to Library"
  - 从unknown_words转入"开始学这个词"
  - 从known_words转入"复习这个词"

---

## 高亗逻辑的优先级（最新版）

```
shouldHighlight(word, user_difficulty_level, known_words, unknown_words):

    # 优先级1：用户明确说不认识，必须高亗
    if word.lower() in unknown_words:
        return True

    # 优先级2：用户明确说认识，不高亗
    if word.lower() in known_words:
        return False

    # 优先级3：根据难度判断（默认规则）
    word_difficulty_rank = CEFR_RANK[word.cefr_level]
    user_rank = CEFR_RANK[user_difficulty_level]

    if word_difficulty_rank >= user_rank:
        return True  # 难度足够，高亗
    else:
        return False  # 太简单，不高亗
```

### 伪代码示例

```
# 场景1：冷门词汇
word = "serendipity" (C1)
user_difficulty = "B2"
known_words = {}
unknown_words = {"serendipity"}

结果：True（高亗）
原因：word在unknown_words中 → 优先级1

---

# 场景2：用户误判，实际认识这个词
word = "beautiful" (B1)
user_difficulty = "B2"
known_words = {"beautiful"}
unknown_words = {}

结果：False（不高亗）
原因：word在known_words中 → 优先级2

---

# 场景3：用户误判，实际不认识这个词
word = "good" (A1)
user_difficulty = "B2"
known_words = {}
unknown_words = {"good"}

结果：True（高亗）
原因：word在unknown_words中 → 优先级1
（即使A1 < B2，仍然高亗）

---

# 场景4：正常情况
word = "serendipity" (C1)
user_difficulty = "B2"
known_words = {}
unknown_words = {}

结果：True（高亗）
原因：C1 >= B2 → 优先级3

---

# 场景5：简单词汇
word = "amazing" (A2)
user_difficulty = "B2"
known_words = {}
unknown_words = {}

结果：False（不高亗）
原因：A2 < B2，且不在任何列表中 → 优先级3
```

---

## 用户交互和数据流

### 用户可以做的操作

| 操作 | 触发位置 | 效果 | 数据变化 |
|------|--------|------|---------|
| **Mark as Known** | 高亗词的tooltip | 移除高亗 | 加入known_words |
| **Mark as Not Known** | ❓ | 添加高亗 | 加入unknown_words |
| **Add to Library** | 高亗词的tooltip | 标记为学习 | 加入vocabulary |
| **Remove from Library** | Popup中vocabulary列表 | 移除学习 | 从vocabulary移除 |
| **调整难度滑块** | Popup难度滑块 | 动态更新高亗 | 仅改变user_difficulty_level |

### 🤔 问题：用户如何"Mark as Not Known"？

当前的UI中，用户主要在两个地方：
1. **Content Script中** - 看到高亗的词
2. **Popup中** - 看到统计信息和settings

问题：用户在网页中看到一个**没有高亗的词**，想要标记为"我不认识"，应该如何操作？

**可能的方案**：

**方案A：支持右键菜单**
```
用户在网页中右键点击任何词
→ 出现菜单："Mark as Not Known"
→ 词汇被添加到unknown_words
→ 下次加载页面时，该词被高亗
```

**方案B：Popup中的搜索添加**
```
Popup中有一个输入框：
"没有看到某个词？输入词汇 → Add to Learning"
→ 用户输入一个词
→ 添加到unknown_words + vocabulary
→ 这个词现在被高亗 + 进入学习
```

**方案C：简化版（推荐）**
```
只在用户点击"Add to Library"时提供选项：
"这个词我已经认识，我想复习它" → 加入known_words + vocabulary
"这个词我想学" → 加入vocabulary
"这个词太冷门，我现在不想学" → 仅加入unknown_words

但这样需要用户主动去Popup或搜索，不像Mark as Known那么直接
```

---

## 数据存储结构

### 后端（数据库）

```python
class UserModel:
    user_id: str
    created_at: datetime
    updated_at: datetime

class KnownWordsModel:
    id: int
    user_id: str  # FK
    word: str
    marked_at: datetime

class UnknownWordsModel:  # 新增
    id: int
    user_id: str  # FK
    word: str
    marked_at: datetime
    reason: str = None  # 可选：用户标记的原因（太冷门、目前不需要等）

class VocabularyEntryModel:
    id: int
    user_id: str  # FK
    word: str
    status: enum (learning, reviewing, mastered)
    added_at: datetime
    last_reviewed: datetime = None
    attempt_count: int = 0
```

### 前端（localStorage）

```javascript
localStorage: {
  user_id: "mixread-user-abc123",

  // 难度设置
  difficulty_level: "B2",

  // 三个词表
  known_words: ["beautiful", "good", ...],
  unknown_words: ["serendipity", "ephemeral", ...],
  vocabulary: ["word1", "word2", ...],  // 或者字典with metadata

  // 缓存（可选）
  word_cache: {
    "serendipity": { cefr: "C1", definition: "..." }
  }
}
```

---

## 初始化流程

### 首次使用

```
Step 1: 用户打开插件
→ 检查user_id是否存在
→ 如果不存在，生成新的user_id并保存

Step 2: 用户设置初始难度（可选）
→ 如果用户想要"自动标记已认识的词"
→ 在Popup中有选项："Set Initial Difficulty as B2"
→ 系统自动把A1-B1的所有词加到known_words

或者用户可以跳过这一步，直接使用默认的B1难度
```

### 这一步是否需要？

用户说"实际就默认他已经认识了很多单词了"

两种理解：
1. **隐含方式**：用户通过调整难度滑块来实现
   - 用户设置为B2 → 隐含地说"我认识A1-B1"
   - 系统根据难度自动计算
   - 如果用户想纠正，再用Mark as Known/Mark as Not Known

2. **显式初始化**：系统提供一个向导
   - 首次使用：选择"你的英文水平" (A1-C2)
   - 系统自动把低于该难度的词加到known_words
   - 用户之后可以纠正

**我的建议**：**用户A（简化方案）** - 不做显式初始化
- 用户打开应用，默认difficulty=B1
- 用户可以随时调整难度滑块
- 调整难度后，页面动态更新高亗（根据新难度计算）
- 如果发现某个词实际不认识，手动Mark as Not Known
- 逐步建立个性化的known_words和unknown_words

**优点**：简单，无初始化成本
**缺点**：用户需要手动调整较多

---

**用户B（带初始化方案）** - 首次使用时可选的初始化
- 首次打开：选项框"你的初始英文水平是？"
- 用户选择B2
- 系统自动把A1-B1+B2的词加到known_words
- 后续用户仍可纠正

**优点**：用户体验更流畅，减少前期调整工作量
**缺点**：有初始化逻辑

---

## 检查是否有遗漏

### ✅ 已覆盖的维度
- [x] 难度规则（implicit，通过difficulty_level）
- [x] known_words（用户明确说认识）
- [x] unknown_words（用户明确说不认识）
- [x] 优先级明确（unknown > known > difficulty_default）

### ⚠️ 需要确认的点
1. **Mark as Not Known的UI** - 在哪里？如何触发？
2. **初始化策略** - 需不需要？
3. **unknown_words的持久化** - 需要同步到后端吗？（目前假设需要）
4. **vocabulary中的词是否自动高亗？** 答案：是的（如果满足高亗条件）

### ❓ 可能的未来需求
- 用户能否查看/编辑完整的known_words列表？
- 用户能否导出/导入词汇表？
- 用户能否在unknown_words中标记"原因"（太冷门、技术术语等）？

---

## 建议的方案

**我推荐：混合方案（用户A + 部分用户B）**

1. **首次使用**：无初始化，直接使用默认B1
2. **动态调整**：用户可以随时调整difficulty_level
3. **逐步纠正**：通过Mark as Known / Mark as Not Known逐步建立个性化词表
4. **可选**：在Settings中提供"Reset to Initial Level"选项（可选初始化）

这样既保留了简单性，又给高级用户提供了灵活性。

---

## 总结

你的设计**没有遗漏**，反而很全面！关键的三个维度都覆盖了：
- ✅ 难度规则
- ✅ known_words（覆盖难度）
- ✅ unknown_words（被覆盖的难度）

我建议的是：
1. 确认Mark as Not Known的UI位置
2. 决定初始化策略（推荐不初始化，让用户逐步调整）
3. 确认unknown_words是否需要sync到后端（推荐需要，用于跨设备）

其他一切都很清晰！
