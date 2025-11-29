# 核心测试 Cases - Mark As Known & Vocabulary 功能

## 后端核心 E2E Test Cases

### TestCase 1: 基础高亗和标记已认识

**场景描述**：用户在页面看到高亗词汇，点击"Mark as Known"后，该词不再被高亗

**前置条件**：
- 用户ID：`test-user-001`
- 页面包含词汇：`["beautiful", "good", "serendipity", "ephemeral"]`
- 用户难度级别：`B1`
- 初始状态：无已认识词汇，无词汇库词汇

**测试步骤**：

```
Step 1: 第一次获取高亗词汇
POST /highlight-words
Body: {
  "user_id": "test-user-001",
  "words": ["beautiful", "good", "serendipity", "ephemeral"],
  "difficulty_level": "B1"
}

期望响应:
{
  "success": true,
  "highlighted_words": ["beautiful", "serendipity", "ephemeral"],
  "word_details": [...]
}

验证：
✅ "beautiful" (B1) 在高亗列表中
✅ "good" (A1) 不在高亗列表中（难度太低）
✅ "serendipity" (C1) 在高亗列表中
✅ "ephemeral" (B2) 在高亗列表中

---

Step 2: 标记"beautiful"为已认识
POST /users/test-user-001/known-words
Body: {"word": "beautiful"}

期望响应:
{
  "success": true,
  "message": "Word marked as known"
}

验证：
✅ API返回success=true

---

Step 3: 再次获取高亗词汇（不包括已认识的词）
POST /highlight-words
Body: {
  "user_id": "test-user-001",
  "words": ["beautiful", "good", "serendipity", "ephemeral"],
  "difficulty_level": "B1"
}

期望响应:
{
  "success": true,
  "highlighted_words": ["serendipity", "ephemeral"],
  "word_details": [...]
}

验证：
✅ "beautiful" 不在高亗列表中（已标记为known）
✅ "serendipity" 仍在高亗列表中
✅ "ephemeral" 仍在高亗列表中

---

Step 4: 查询用户已认识单词列表
GET /users/test-user-001/known-words

期望响应:
{
  "success": true,
  "known_words": ["beautiful"]
}

验证：
✅ "beautiful" 在已认识列表中
```

**数据验证**：
- 数据库：`users["test-user-001"].known_words` 包含 `"beautiful"`
- 数据库：存在 `KnownWordModel(user_id="test-user-001", word="beautiful")`

---

### TestCase 2: 词汇库和已认识单词的独立性

**场景描述**：用户可以独立地添加词汇库和标记已认识单词，两个列表是独立的

**前置条件**：
- 用户ID：`test-user-002`
- 初始状态：无任何数据

**测试步骤**：

```
Step 1: 添加词汇到词汇库（不标记为已认识）
POST /users/test-user-002/vocabulary
Body: {"word": "serendipity"}

期望响应:
{
  "success": true,
  "message": "Word added to vocabulary"
}

验证：
✅ API返回success=true

---

Step 2: 获取用户词汇库
GET /users/test-user-002/vocabulary

期望响应:
{
  "success": true,
  "vocabulary": [
    {
      "word": "serendipity",
      "status": "learning",
      "added_at": "2025-11-29T...",
      "attempt_count": 0
    }
  ]
}

验证：
✅ "serendipity" 在词汇库中
✅ status = "learning"
✅ attempt_count = 0

---

Step 3: 标记"serendipity"为已认识
POST /users/test-user-002/known-words
Body: {"word": "serendipity"}

期望响应:
{
  "success": true
}

验证：
✅ 标记成功

---

Step 4: 验证两个列表都包含该单词
GET /users/test-user-002/vocabulary
GET /users/test-user-002/known-words

期望响应（vocabulary）:
{
  "vocabulary": [{
    "word": "serendipity",
    "status": "learning"
  }]
}

期望响应（known-words）:
{
  "known_words": ["serendipity"]
}

验证：
✅ "serendipity" 在词汇库中（仍然是学习状态）
✅ "serendipity" 在已认识列表中（用于高亗过滤）

---

Step 5: 高亗不再显示"serendipity"
POST /highlight-words
Body: {
  "user_id": "test-user-002",
  "words": ["serendipity"],
  "difficulty_level": "B1"
}

期望响应:
{
  "success": true,
  "highlighted_words": []
}

验证：
✅ "serendipity" 不在高亗列表中（被过滤了）
✅ 但仍在词汇库中（用于后续闪卡复习）
```

**数据验证**：
- 数据库：`VocabularyEntryModel(word="serendipity")` 存在
- 数据库：`KnownWordModel(word="serendipity")` 存在
- 两个都存在，互不影响

---

### TestCase 3: 跨设备同步（相同user_id）

**场景描述**：设备A和设备B使用相同的user_id，应该看到相同的数据

**前置条件**：
- 设备A user_id：`sync-user-001`
- 设备B user_id：`sync-user-001`（相同）
- 设备A已标记："beautiful", "good"为已认识
- 设备A已添加："serendipity", "ephemeral"到词汇库

**测试步骤**：

```
Step 1: 设备B查询已认识单词
GET /users/sync-user-001/known-words

期望响应:
{
  "success": true,
  "known_words": ["beautiful", "good"]
}

验证：
✅ 看到设备A标记的已认识单词

---

Step 2: 设备B查询词汇库
GET /users/sync-user-001/vocabulary

期望响应:
{
  "success": true,
  "vocabulary": [
    {"word": "serendipity", "status": "learning"},
    {"word": "ephemeral", "status": "learning"}
  ]
}

验证：
✅ 看到设备A添加的词汇库

---

Step 3: 设备B也标记一个新词为已认识
POST /users/sync-user-001/known-words
Body: {"word": "amazing"}

期望响应:
{
  "success": true
}

---

Step 4: 设备A查询已认识单词（验证同步）
GET /users/sync-user-001/known-words

期望响应:
{
  "success": true,
  "known_words": ["beautiful", "good", "amazing"]
}

验证：
✅ 看到设备B新标记的"amazing"
```

**数据验证**：
- 两个设备获取的known_words完全相同
- 两个设备获取的vocabulary完全相同

---

### TestCase 4: 高亗过滤逻辑的完整验证

**场景描述**：验证高亗逻辑同时考虑难度、已认识单词和翻译存在

**前置条件**：
- 用户ID：`filter-test-001`
- 用户难度级别：`B1`
- 用户已认识单词：`["good", "beautiful"]`
- 页面词汇：`["good", "beautiful", "serendipity", "ephemeral", "amazing", "wonderful"]`

**逻辑验证表**：

| 单词 | CEFR | 已认识? | 难度判断 | 有翻译? | 应该高亗? | 原因 |
|------|------|---------|---------|--------|----------|------|
| good | A1 | 是 | < B1 | 是 | ❌ | 难度太低 + 已认识 |
| beautiful | B1 | 是 | = B1 | 是 | ❌ | 已认识 |
| serendipity | C1 | 否 | > B1 | 是 | ✅ | 难度够 + 未认识 |
| ephemeral | B2 | 否 | > B1 | 是 | ✅ | 难度够 + 未认识 |
| amazing | A2 | 否 | < B1 | 是 | ❌ | 难度太低 |
| wonderful | B1 | 否 | = B1 | 是 | ✅ | 难度够 + 未认识 |

**测试步骤**：

```
POST /highlight-words
Body: {
  "user_id": "filter-test-001",
  "words": ["good", "beautiful", "serendipity", "ephemeral", "amazing", "wonderful"],
  "difficulty_level": "B1"
}

期望响应:
{
  "success": true,
  "highlighted_words": ["serendipity", "ephemeral", "wonderful"],
  "word_details": [...]
}

验证：
✅ 不包含"good"（难度A1 < B1）
✅ 不包含"beautiful"（已认识）
✅ 包含"serendipity"（C1 >= B1，未认识）
✅ 包含"ephemeral"（B2 >= B1，未认识）
✅ 不包含"amazing"（难度A2 < B1）
✅ 包含"wonderful"（B1 >= B1，未认识）
```

---

## 前端核心集成测试 Cases

### TestCase A: "Mark as Known" 按钮交互

**场景描述**：用户点击tooltip中的"Mark as Known"按钮，前端调用API，更新本地存储

**前置条件**：
- Content Script已加载
- Popup已打开
- 用户ID：`frontend-test-001`
- 页面高亗词汇：`["beautiful"]`

**测试步骤**：

```
Step 1: 用户点击高亗的词"beautiful"
→ 触发click事件
→ 显示tooltip

验证：
✅ Tooltip显示
✅ Tooltip包含词汇信息：word, definition, examples, etc.
✅ "Mark as Known"按钮可见

---

Step 2: 用户点击"Mark as Known"按钮
→ 触发按钮click事件
→ 前端调用API：POST /users/{user_id}/known-words

期望API调用：
{
  method: "POST",
  url: "/users/frontend-test-001/known-words",
  body: {"word": "beautiful"}
}

验证：
✅ API调用成功（假设响应 success=true）

---

Step 3: 本地存储已更新
→ knownWordsStore 已添加 "beautiful"
→ 触发 "known-words-updated" 事件

验证：
✅ localStorage["known_words"] 包含 "beautiful"
✅ 事件已触发

---

Step 4: 重新高亗页面
→ 使用新的known_words列表
→ "beautiful" 被过滤掉，不再高亗

验证：
✅ 页面上"beautiful"的黄色高亗消失
✅ Tooltip自动关闭
```

**本地存储验证**：
- `localStorage["user_id"]` = `"frontend-test-001"`
- `localStorage["known_words"]` 包含 `"beautiful"`

---

### TestCase B: "Add to Library" 按钮交互

**场景描述**：用户点击"Add to Library"，前端添加到词汇库，本地存储和API同步

**前置条件**：
- Content Script已加载
- 用户ID：`frontend-test-002`
- 高亗词汇：`["serendipity"]`

**测试步骤**：

```
Step 1: 用户点击高亗词"serendipity"
→ 显示tooltip
→ "Add to Library"按钮可见

验证：
✅ 按钮可见

---

Step 2: 用户点击"Add to Library"按钮
→ 前端调用API：POST /users/{user_id}/vocabulary

期望API调用：
{
  method: "POST",
  url: "/users/frontend-test-002/vocabulary",
  body: {"word": "serendipity"}
}

验证：
✅ API调用成功

---

Step 3: 本地存储已更新
→ vocabularyStore 已添加 "serendipity"

验证：
✅ localStorage["vocabulary"] 包含 "serendipity"

---

Step 4: Popup中更新词汇库显示
→ 用户打开popup
→ "Vocabulary"部分显示"serendipity"

验证：
✅ Popup显示新添加的单词
✅ 词汇库计数 +1
```

---

### TestCase C: Popup中切换设备 (User ID)

**场景描述**：用户可以在popup中输入新的user_id，切换到另一个设备的数据

**前置条件**：
- 当前user_id：`device-a-user`
- 目标user_id：`device-b-user`
- 后端已存储device-b-user的数据

**测试步骤**：

```
Step 1: 打开Popup
→ 显示当前user_id：device-a-user

验证：
✅ 用户ID显示正确

---

Step 2: 点击"Change Device ID"按钮
→ 打开输入框

验证：
✅ 输入框出现
✅ 可编辑

---

Step 3: 输入新的user_id：device-b-user
→ 提交

验证：
✅ 输入框接收新ID

---

Step 4: 前端调用API验证user_id
→ GET /users/device-b-user

期望响应：
{
  "success": true,
  "user_data": {...}
}

验证：
✅ API返回success=true

---

Step 5: 本地存储已更新
→ localStorage["user_id"] = "device-b-user"
→ 重新加载known_words和vocabulary

验证：
✅ 显示的数据更新为device-b-user的数据
✅ Popup中统计数据更新
```

---

### TestCase D: 跨模块事件驱动

**场景描述**：当known-words更新时，自动触发页面重新高亗（事件驱动）

**前置条件**：
- Content Script已监听 "known-words-updated" 事件
- 页面已高亗

**测试步骤**：

```
Step 1: 触发"known-words-updated"事件
window.dispatchEvent(new Event('known-words-updated'))

---

Step 2: Content Script监听器被调用
→ 重新获取全部高亗词汇
→ 调用 highlightFilter.getHighlightedWords()

验证：
✅ 事件监听器被执行

---

Step 3: 重新渲染DOM
→ highlightRenderer.highlight() 被调用
→ 移除已认识单词的高亗
→ 保留新的高亗

验证：
✅ DOM更新
✅ 已认识单词失去黄色高亗
```

---

## 总结：关键验证点

### 后端验证
- ✅ API返回正确的highlighted_words（过滤already known）
- ✅ 数据库正确存储known_words和vocabulary
- ✅ 多个用户的数据隔离
- ✅ 跨设备同步（相同user_id）

### 前端验证
- ✅ UI正确调用API
- ✅ 本地存储正确更新
- ✅ 事件系统正确触发
- ✅ DOM正确重新渲染
- ✅ 用户ID切换正确

---

## 开发顺序建议

1. **后端优先**（TestCase 1-4）
   - 实现Domain、Application、Infrastructure层
   - 实现API routes
   - 所有E2E测试通过

2. **前端随后**（TestCase A-D）
   - 实现modules和stores
   - 实现UI交互
   - 集成测试通过

3. **完整端到端验证**
   - 前后端联动测试
   - UI点击→API调用→数据库→页面刷新
