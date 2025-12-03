# 单词列表的概念澄清

## 核心区分：两个完全独立的维度

### 维度1：**高亗维度** (Display Dimension)

**known_words** vs **unknown_words**

作用：**决定单词在网页上是否被高亗显示**

#### known_words（已认识）
- 定义：用户明确说"我认识这个词"
- 来源：
  - 用户点击"Mark as Known"
  - 用户初始化时设置的难度级别（隐含）
- 效果：**这个词在网页上不高亗，即使用户再次看到**
- 学习关联：无（可能用户只是认识，不需要深度学习）

#### unknown_words（不认识）
- 定义：用户明确说"我不认识这个词"
- 来源：
  - 用户点击"Mark as Not Known"（网页中没有高亗的词）
  - 用户想要主动学这个词但当前难度设置太低
- 效果：**这个词在网页上被高亗显示，方便用户查看定义**
- 学习关联：**无**（用户只是想看到这个词的定义，不一定要背诵）

#### 关键区分：unknown_words ≠ vocabulary

```
用户在网页看到"ephemeris"（很冷门的词）
→ 点击"Mark as Not Known"
→ 这个词加入unknown_words
→ 下次看到这个词时被高亗，用户可以快速查看定义

但用户**不想背这个词**
→ 不需要加入vocabulary
→ 闪卡系统中不会出现这个词
```

---

### 维度2：**学习维度** (Learning Dimension)

**vocabulary** - 用户明确的学习意图

#### vocabulary（词汇库）
- 定义：用户明确说"我想学习这个词"
- 来源：
  - 用户点击"Add to Library"
  - 用户从unknown_words手动转移（"我决定学这个词"）
  - 用户从知识库/搜索添加
- 效果：
  - 这个词进入**闪卡系统**
  - 用于后续的背诵、复习、掌握追踪
- 学习关联：**有**（这个词是用户的学习目标）

---

## 完整的单词状态流转图

```
网页中的词汇
  ↓
【高亗决策】
  ├─ unknown_words? → YES → 高亗
  ├─ known_words?   → YES → 不高亗
  └─ 难度规则?      → 判断

如果高亗：
  ↓
【用户点击】
  ├─ "Mark as Known"  → 加入known_words，同时从vocabulary移除
  ├─ "Add to Library" → 加入vocabulary（如果不在，则加入）
  └─ 不点击           → 仍在unknown_words

如果不高亗但在unknown_words：
  ↓
【用户想学】
  └─ "Start Learning" → 从unknown_words转移到vocabulary
```

---

## 四种单词列表的完整对应关系

| 单词 | 在known_words? | 在unknown_words? | 在vocabulary? | 高亗? | 可学? |
|------|---|---|---|---|---|
| "beautiful" (B1) | ✅ | ❌ | ❌ | ❌ | ❌ |
| "serendipity" (C1) | ❌ | ❌ | ✅ | ✅ | ✅ (学习中) |
| "ephemeris" (C2) | ❌ | ✅ | ❌ | ✅ | ❌ (知道意思，不想学) |
| "good" (A1) | ❌ | ❌ | ❌ | ❌ | ❌ (太简单) |
| "mysterious" (B2) | ❌ | ❌ | ❌ | ✅ | ✅ (可选择学) |

---

## 用户交互场景

### 场景1：用户认识某个词（Mark as Known）

```
网页显示："beautiful"被高亗
  ↓
用户点击 → tooltip出现
  ↓
用户看到定义，意识到"哦我认识这个词"
  ↓
点击"Mark as Known"
  ↓
数据变化：
  - 加入known_words
  - 从vocabulary移除（如果之前添加过）
  - unknown_words中移除（如果曾在）
  ↓
效果：这个词不再高亗
```

### 场景2：用户看到陌生词汇，只想查意思（Mark as Not Known）

```
网页显示："ephemeris"没有高亗（因为C2级别，用户设置为B2）
  ↓
用户右键 → "Mark as Not Known"（或通过popup搜索）
  ↓
数据变化：
  - 加入unknown_words
  - 不自动加入vocabulary
  ↓
效果：
  - 这个词现在被高亗
  - 用户下次看到时可以快速查定义
  - 但不会在闪卡中出现
```

### 场景3：用户想学习一个词（Add to Library）

```
网页显示："serendipity"被高亗
  ↓
用户点击 → tooltip
  ↓
用户读了定义，觉得"这个词不错，我想学"
  ↓
点击"Add to Library"
  ↓
数据变化：
  - 加入vocabulary
  - status = "learning"
  - unknown_words中移除（如果曾在）
  ↓
效果：
  - 这个词进入闪卡系统
  - 闪卡会问"serendipity"是什么？
  - 用户背诵、掌握、复习
```

### 场景4：用户不想学某个冷门词，只是想查定义（Mark as Not Known，不Add to Library）

```
网页显示："sesquipedalian"没有高亗（太冷门）
  ↓
用户右键 → "Mark as Not Known"
  ↓
数据变化：
  - 加入unknown_words
  ↓
后续如果想学：
  - 用户点击"Start Learning"
  - 从unknown_words转移到vocabulary
  ↓
或者继续看不学：
  - 这个词就永远在unknown_words中
  - 高亗显示，但不在闪卡中
```

### 场景5：用户从unknown_words转移到vocabulary（延迟学习）

```
之前：
- "ephemeris"在unknown_words（用户只是想查意思）

后来用户决定：
- "哦，这个词其实还不错，我决定学它"
  ↓
用户点击"Start Learning"（或通过popup操作）
  ↓
数据变化：
  - 从unknown_words移除
  - 加入vocabulary
  - status = "learning"
  ↓
效果：
  - 这个词进入闪卡系统
  - 闪卡会问这个词的定义
```

---

## 完整的高亗逻辑（三维）

```python
def should_highlight(word, user_difficulty, known_words, unknown_words, vocabulary):
    """
    高亗优先级：
    1. unknown_words - 明确的"我想看这个词"
    2. known_words - 明确的"我认识这个词"
    3. 难度规则 - 默认判断
    """

    # 优先级1：用户明确标记为不认识（高优先级）
    if word.lower() in unknown_words:
        return True  # 高亗

    # 优先级2：用户明确标记为认识
    if word.lower() in known_words:
        return False  # 不高亗

    # 优先级3：根据难度判断
    word_rank = CEFR_RANK[word.cefr_level]
    user_rank = CEFR_RANK[user_difficulty]

    if word_rank >= user_rank:
        return True  # 高亗
    else:
        return False  # 不高亗

# 注意：vocabulary与高亗逻辑无关
# vocabulary只用于学习维度（闪卡、复习等）
```

---

## 数据模型更新

### 后端数据库

```python
class UserModel:
    user_id: str
    created_at: datetime
    updated_at: datetime

class KnownWordsModel:
    """用户标记为"已认识"的词"""
    user_id: str  # FK
    word: str
    marked_at: datetime

class UnknownWordsModel:  # 新增
    """用户标记为"不认识"（但不一定要学）的词"""
    user_id: str  # FK
    word: str
    marked_at: datetime
    note: str = None  # 可选：用户备注（太冷门、技术术语等）

class VocabularyEntryModel:
    """用户想要学习的词"""
    user_id: str  # FK
    word: str
    status: enum (learning, reviewing, mastered)  # Phase 2+
    added_at: datetime
    last_reviewed: datetime = None
    attempt_count: int = 0

# 关键：unknown_words和vocabulary完全独立
# 一个词可能在unknown_words但不在vocabulary
# 一个词可能在vocabulary但不在unknown_words
```

### 前端localStorage

```javascript
localStorage: {
  user_id: "mixread-user-abc123",

  // 高亗维度
  known_words: ["beautiful", "good"],
  unknown_words: ["serendipity", "ephemeris"],  // 新增

  // 学习维度
  vocabulary: {
    "serendipity": {status: "learning", added_at: "..."},
    "mysterious": {status: "learning", added_at: "..."}
  },

  // 设置
  difficulty_level: "B2"
}
```

---

## 明确的操作和数据变化

### Mark as Known
- 触发：用户点击高亗词的"Mark as Known"
- 数据变化：
  - ✅ 加入known_words
  - ❌ 从unknown_words移除（如果在）
  - ❌ 从vocabulary移除（如果在）
- 效果：词不再高亗

### Mark as Not Known
- 触发：用户右键点击或在popup搜索（未高亗词）
- 数据变化：
  - ✅ 加入unknown_words
  - ❌ 从known_words移除（如果在）
  - ❌ 不自动加入vocabulary
- 效果：词被高亗

### Add to Library
- 触发：用户点击高亗词的"Add to Library"
- 数据变化：
  - ✅ 加入vocabulary (status="learning")
  - ❌ 从unknown_words移除（如果在）
  - ❌ 从known_words移除（如果在）
- 效果：词进入闪卡系统

### Start Learning (新增操作)
- 触发：用户在unknown_words词汇上点击"Start Learning"
- 数据变化：
  - ✅ 加入vocabulary
  - ✅ 从unknown_words移除
- 效果：词从高亗查询转为学习

### Mark as Mastered (Phase 2)
- 触发：用户在vocabulary中标记掌握
- 数据变化：
  - ✅ vocabulary中status改为"mastered"
  - ✅ 加入known_words（可选，用于隐藏高亗）
- 效果：词从学习转为掌握

---

## 总结

**关键理解**：

1. **unknown_words是高亗维度**
   - 用途：让用户在阅读时看到定义
   - 不代表要背诵学习
   - 是"我想知道这个词的意思"

2. **vocabulary是学习维度**
   - 用途：用于闪卡系统背诵
   - 代表"我决定掌握这个词"
   - 是"我想深度学习这个词"

3. **两者独立但可转换**
   - unknown_words ← → vocabulary
   - 用户可以从unknown转到vocabulary（"我要学它"）
   - 用户可以从vocabulary转到mastered（"我学会了"）
   - 用户可以从任何地方转到known（"我认识它"）

4. **不是所有高亗词都要学**
   - 用户可能只想看个别冷门词的定义
   - 通过unknown_words实现，无需加vocabulary
   - 降低用户学习压力

---

## 问题确认清单

1. ✅ **unknown_words和vocabulary的概念区分** - 已澄清
2. ❓ **Mark as Not Known的UI** - 仍需确认（右键菜单？搜索框？）
3. ❓ **初始化策略** - 仍需确认（需要吗？）
4. ❓ **unknown_words跨设备同步** - 仍需确认（sync到后端吗？）
