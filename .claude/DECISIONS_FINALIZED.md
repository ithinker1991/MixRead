# 最终决策确认

## 三个关键决策

### ✅ 决策1：Mark as Not Known的UI
**选项**：右键菜单
**实现**：用户在网页上右键点击任何词 → 上下文菜单出现 → 选择"Mark as Not Known"

```
用户体验流程：
1. 用户在网页看到"ephemeris"（没有高亗）
2. 右键点击"ephemeris"
3. 上下文菜单出现：
   - "Mark as Not Known" ← 新增操作
   - "Search in popup"  (可选)
4. 点击"Mark as Not Known"
5. 词被添加到unknown_words（后端+本地）
6. 页面重新高亗，"ephemeris"现在被高亗显示
```

**技术实现**：
```javascript
// content.js
document.addEventListener('contextmenu', (e) => {
  const word = getWordFromEvent(e);
  if (word) {
    showContextMenu(e, word);
  }
});

function showContextMenu(e, word) {
  const menu = document.createElement('div');
  menu.innerHTML = `
    <div class="mixread-context-menu">
      <button data-action="mark-as-not-known">Mark as Not Known</button>
      <button data-action="search">Search Definition</button>
    </div>
  `;
  // 显示菜单...
}

document.addEventListener('click', async (e) => {
  if (e.target.dataset.action === 'mark-as-not-known') {
    const word = e.target.dataset.word;
    await unknownWordsService.markAsNotKnown(word);
  }
});
```

---

### ✅ 决策2：初始化策略
**方案**：不初始化，直接用默认B1难度
**后续**：可以考虑引导用户（但不强制）

**启动流程**：
```
用户首次打开MixRead
  ↓
检查user_id是否存在 → 不存在则创建
  ↓
difficulty_level = "B1"（默认）
  ↓
known_words = [] （空）
  ↓
unknown_words = [] （空）
  ↓
用户开始使用，逐步通过Mark as Known/Mark as Not Known建立个性化词表
  ↓
（可选）如果用户一段时间后，Popup中提示："建议你根据阅读体验调整难度"
```

**好处**：
- ✅ 简单，无初始化成本
- ✅ 让用户逐步体验和调整
- ✅ 避免初始化的误判

---

### ✅ 决策3：unknown_words存储和同步
**策略**：所有unknown_words存放在后端，前端缓存
**同步**：自动通过后端API实现，无需额外机制

**架构设计**：

```
┌─────────────────────────────────────────┐
│         前端（Chrome Extension）         │
├─────────────────────────────────────────┤
│ localStorage:                          │
│ - user_id                              │
│ - difficulty_level                     │
│ - known_words (缓存)                    │
│ - unknown_words (缓存) ← 新增           │
│ - vocabulary (缓存)                     │
└──────────────┬──────────────────────────┘
               │
          ① 启动加载
          ② 实时更新
          ③ 定期同步
               │
┌──────────────▼──────────────────────────┐
│        后端（FastAPI）                   │
├──────────────────────────────────────────┤
│ 数据库：                                 │
│ - users                                 │
│ - known_words                           │
│ - unknown_words ← 新增                  │
│ - vocabulary_entries                    │
└──────────────────────────────────────────┘
```

**数据流**：

```
场景A：用户在设备A Mark as Not Known "ephemeris"
  ↓
前端调用API：POST /users/{user_id}/unknown-words
  Body: {"word": "ephemeris"}
  ↓
后端保存到数据库 + 返回success
  ↓
前端更新localStorage中的unknown_words
  ↓
页面重新高亗

场景B：用户打开设备B（相同user_id）
  ↓
前端启动时调用API：GET /users/{user_id}/unknown-words
  ↓
后端返回所有unknown_words列表
  ↓
前端缓存到localStorage
  ↓
页面高亗时使用这个列表
  ↓
设备B自动看到设备A添加的unknown_words
```

**关键点**：
- ✅ 后端是**真实来源** (Source of Truth)
- ✅ 前端只是**缓存** (Cache Layer)
- ✅ 多设备通过后端自动同步
- ✅ 无需额外的同步机制

---

## API设计（更新版）

### GET /users/{user_id}/unknown-words
获取用户的所有unknown_words（用于首次加载或设备同步）

```
请求：
GET /users/test-user-001/unknown-words

响应：
{
  "success": true,
  "unknown_words": [
    {
      "word": "ephemeris",
      "marked_at": "2025-11-29T10:30:00Z"
    },
    {
      "word": "sesquipedalian",
      "marked_at": "2025-11-29T11:00:00Z"
    }
  ]
}
```

### POST /users/{user_id}/unknown-words
添加词汇到unknown_words

```
请求：
POST /users/test-user-001/unknown-words
Body: {"word": "ephemeris"}

响应：
{
  "success": true,
  "message": "Word marked as not known"
}
```

### DELETE /users/{user_id}/unknown-words/{word}
从unknown_words移除词汇

```
请求：
DELETE /users/test-user-001/unknown-words/ephemeris

响应：
{
  "success": true,
  "message": "Word removed from unknown words"
}
```

### 高亗过滤API（更新）
POST /highlight-words 增加unknown_words的支持

```
请求：
POST /highlight-words
Body: {
  "user_id": "test-user-001",
  "words": ["beautiful", "ephemeris", "mysterious"],
  "difficulty_level": "B2"
}

响应（后端已包含unknown_words过滤）：
{
  "success": true,
  "highlighted_words": ["mysterious", "ephemeris"],
  "word_details": [...]
}
```

---

## 前端缓存/请求策略

### 启动流程

```javascript
async function initializeUser() {
  // Step 1: 加载user_id
  const userId = await StorageManager.getItem('user_id');
  if (!userId) {
    const newUserId = generateUserId();
    await StorageManager.setItem('user_id', newUserId);
  }

  // Step 2: 从后端同步数据
  try {
    // 并行加载
    const [knownWords, unknownWords, vocabulary] = await Promise.all([
      apiClient.get(`/users/${userId}/known-words`),
      apiClient.get(`/users/${userId}/unknown-words`),  // 新增
      apiClient.get(`/users/${userId}/vocabulary`)
    ]);

    // Step 3: 缓存到localStorage
    await StorageManager.setItem('known_words', knownWords.data);
    await StorageManager.setItem('unknown_words', unknownWords.data);  // 新增
    await StorageManager.setItem('vocabulary', vocabulary.data);

  } catch (error) {
    // 离线处理：使用本地缓存
    console.warn('Failed to sync, using local cache');
    const cachedUnknown = await StorageManager.getItem('unknown_words') || [];
    unknownWordsStore.load(cachedUnknown);
  }
}
```

### 实时更新流程

```javascript
async function markAsNotKnown(word) {
  const userId = userStore.getUserId();

  try {
    // 1. 立即更新本地缓存（快速反馈）
    unknownWordsStore.add(word);

    // 2. 异步调用API（后台同步）
    await apiClient.post(`/users/${userId}/unknown-words`, {word});

    // 3. 触发重新高亗
    window.dispatchEvent(new Event('unknown-words-updated'));

  } catch (error) {
    // API失败时，本地已经更新了
    // 下次启动时会从后端重新同步
    logger.warn('Failed to sync unknown word, will retry on next load', error);
  }
}
```

### 离线处理

```javascript
// 如果前端加载unknown_words失败（离线）
// 使用本地缓存（localStorage中的旧数据）

async function getUnknownWords() {
  try {
    // 优先从后端获取最新数据
    const response = await apiClient.get(`/users/${userId}/unknown-words`);
    return response.unknown_words;
  } catch (error) {
    // 离线或API失败，使用本地缓存
    return await StorageManager.getItem('unknown_words') || [];
  }
}
```

---

## 测试验证

### E2E测试：跨设备unknown_words同步

```
Step 1: 设备A Mark as Not Known "ephemeris"
POST /users/device-a-user/unknown-words
Body: {"word": "ephemeris"}
  ↓
Step 2: 验证数据库保存成功
数据库查询：SELECT * FROM unknown_words WHERE user_id='device-a-user'
  ↓
Step 3: 设备B同步数据
GET /users/device-a-user/unknown-words
  ↓
Step 4: 验证"ephemeris"在响应中
Assert: "ephemeris" in response.unknown_words
  ↓
Step 5: 验证页面高亗
前端高亗过滤：should_highlight("ephemeris", "B2", {}, {"ephemeris"})
Assert: return True
```

---

## 总结：最终架构

| 组件 | 设计 | 说明 |
|------|------|------|
| **Mark as Not Known UI** | 右键菜单 | 用户体验自然 |
| **初始化** | 无初始化 | B1默认，逐步调整 |
| **unknown_words存储** | 后端数据库 | 单一真实来源 |
| **前端缓存** | localStorage | 性能优化 |
| **同步机制** | API自动同步 | 无额外机制 |
| **离线支持** | 本地缓存降级 | 网络不稳定时可用 |

---

## 确认清单

- ✅ Mark as Not Known用右键菜单
- ✅ 默认B1难度，无初始化
- ✅ unknown_words全部存后端
- ✅ 前端缓存 + 后端同步 = 自动跨设备
- ✅ 如果前端没有缓存，启动时从后端加载

**现在可以开工了！** 🚀
