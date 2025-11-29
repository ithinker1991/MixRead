# 功能规划：单词标注与词汇库管理

## 第一步：梳理单词的不同状态及其含义

### 用户的单词学习生命周期

当用户在阅读英文文章时，会遇到不同的单词：

```
第一次遇见单词
    ↓
用户决定：这是新单词还是已认识的单词？
    ├─ 新单词（需要学习）
    │   ├─ 想要集中学习 → 加入词汇库
    │   └─ 只是理解一下 → 不加词汇库
    │
    └─ 已认识的单词（之前学过，不需要高亮）
        ├─ 想要复习巩固 → 加入词汇库
        └─ 不需要复习 → 只标记为已认识
```

### 核心概念：两个独立维度

#### 维度1：**高亮状态** (是否需要系统高亮提示)
- **new** (新单词)：用户未见过，系统应该高亮提示
- **known** (已认识)：用户已经认识，不需要系统高亮

**意义**：控制阅读体验的难度
- 标记为"known"的单词不再高亮，减少阅读干扰
- 帮助用户逐步从"mixed模式"过渡到"纯英文模式"

#### 维度2：**词汇库状态** (是否需要重点学习/复习)
- **in_library** (词汇库中)：用户想要集中学习或复习这个单词
- **not_in_library** (不在词汇库)：只是阅读时遇到的单词，不需要重点学习

**意义**：标志学习意图
- 词汇库中的单词后续用于闪卡复习（Phase 2）
- 帮助用户区分"需要掌握的关键词"和"读懂就行的单词"

### 单词的四种状态组合

| 高亮状态 | 词汇库状态 | 含义 | 用户操作 |
|---------|----------|------|--------|
| **new** | in_library | 新单词，想要重点学习 | "Add to Library" |
| **new** | not_in_library | 新单词，只需阅读理解 | 不做任何操作 |
| **known** | in_library | 已认识，但想要复习巩固 | "Mark as Known" + "Add to Library" |
| **known** | not_in_library | 已认识，不需要重点学习 | "Mark as Known" |

### 用户交互场景

**场景1：新单词，想学习**
```
用户在文章中看到陌生词 → 单词被高亮 → 用户点击"Add to Library"
→ 单词标记为(new, in_library)
→ 后续在词汇库和闪卡中复习
```

**场景2：新单词，不想重点学**
```
用户看到高亮的新词，但这不是他想学的 → 用户点击"Mark as Known/Skip"
→ 单词标记为(known, not_in_library)
→ 不再高亮，不加入词汇库
```

**场景3：已认识的单词被高亮了（误判）**
```
用户发现已认识的词被高亮 → 点击"Mark as Known"
→ 单词标记为(known, not_in_library)
→ 此单词不再高亗，日后此网站不再高亮此词
```

**场景4：复习已掌握的词**
```
用户想巩固已经掌握的单词 → 点击词汇库中的单词 → 标记为"in_library"
→ 这些词进入闪卡系统复习（Phase 2）
```

---

## 第二步：数据模型设计

### 后端：已认识单词列表（需要用户认证）

**表结构**：`user_known_words`
```json
{
  "user_id": "user_123",
  "known_words": [
    {
      "word": "beautiful",
      "marked_at": "2025-11-29T10:30:00Z",
      "context_url": "https://example.com/article1"
    }
  ]
}
```

**关键特性**：
- 存储用户标记为"已认识"的所有单词
- 记录标记时间（可用于分析学习速度）
- 可选：记录标记时的URL或上下文

### 后端：词汇库（需要用户认证）

**表结构**：`user_vocabulary`（扩展现有结构）
```json
{
  "user_id": "user_123",
  "vocabulary": [
    {
      "word": "serendipity",
      "cefr_level": "C1",
      "added_at": "2025-11-29",
      "status": "learning",  // learning | reviewing | mastered (Phase 2用)
      "attempt_count": 0,
      "last_reviewed": null
    }
  ]
}
```

**关键变化**：
- 添加`status`字段（当前MVP只用"learning"）
- 添加`attempt_count`（为Phase 2的闪卡做准备）
- 添加`last_reviewed`（为Phase 2的复习间隔做准备）

### 前端：localStorage缓存（用于离线和性能）

```javascript
{
  // 用户标记为"已认识"的单词（与后端同步）
  "known_words": new Set(["beautiful", "good", "happy"]),

  // 词汇库单词（与后端同步）
  "vocabulary": ["serendipity", "ephemeral", ...],
  "vocabulary_metadata": {
    "serendipity": {
      "status": "learning",
      "added_at": "2025-11-29",
      "attempt_count": 0
    }
  },

  // 离线缓存（降低API调用）
  "word_cache": {
    "serendipity": {
      "cefr_level": "C1",
      "definition": "..."
    }
  }
}
```

---

## 第三步：高亮逻辑改进

### 当前逻辑（MVP Phase 1）
```
应该高亮？ ← 是否在CEFR数据库中 AND 是否有中文翻译 AND 难度是否 >= 用户难度级别
```

### 新逻辑（有用户认证时）
```
应该高亗？ ← (不在"已认识列表"中 AND 难度 >= 用户难度级别 AND 在词汇库中)
           OR (不在"已认识列表"中 AND 难度 >= 用户难度级别 AND 未在词汇库过滤）
```

**简化版本（无用户认证，本地高亮）**
```
应该高亗？ ← 不在"已认识列表"中
           AND 难度 >= 用户难度级别
           AND 在CEFR数据库中
           AND 有中文翻译
```

---

## 第四步：API设计（后端扩展）

### 用户认证相关（Phase 2之前需要）
```
POST /auth/register
POST /auth/login
POST /auth/logout
GET /user/profile
```

### 已认识单词API
```
POST /user/known-words
  请求：{"word": "beautiful"}
  响应：{"success": true}

DELETE /user/known-words/{word}
  请求：{}
  响应：{"success": true}

GET /user/known-words
  请求：{}
  响应：{"known_words": ["beautiful", "good", ...]}

POST /highlight-words-filtered
  请求：{"words": [...], "difficulty_level": "B1"}
  响应：{
    "highlighted_words": [...],
    "word_details": [...]
  }
  注：后端已过滤掉已认识单词
```

### 词汇库API（扩展）
```
POST /user/vocabulary
  请求：{"word": "serendipity"}
  响应：{"success": true, "word_id": "..."}

PUT /user/vocabulary/{word}
  请求：{"status": "learning"}
  响应：{"success": true}

DELETE /user/vocabulary/{word}
  响应：{"success": true}

GET /user/vocabulary
  响应：{
    "vocabulary": [
      {"word": "serendipity", "status": "learning", ...}
    ]
  }
```

---

## 第五步：实现阶段规划

### 阶段1：本地化实现（当前，无后端同步）
**目标**：用户在本设备上可以标记"已认识"单词，不再高亗

**需要做**：
1. 扩展localStorage：添加`known_words` Set
2. 修改高亗逻辑：检查`known_words`列表
3. 前端UI：在popup中添加"标记已认识"功能
4. 前端UI：在tooltip中添加"Mark as Known"按钮
5. 同步逻辑：修改`/highlight-words` API请求，让前端先过滤`known_words`

**Happy Path**：
- 用户点击"Mark as Known" → 单词存入localStorage → 重新高亗 → 单词不再显示

### 阶段2：用户认证与跨设备同步（Phase 2）
**目标**：用户登录后，已认识列表和词汇库在云端同步

**需要做**：
1. 实现用户认证（OAuth 或邮箱注册）
2. 后端创建`known_words`表和API
3. 后端修改`/highlight-words` API，在服务器端过滤`known_words`
4. 前端：登录/登出逻辑
5. 前端：后台同步线程，定期上传本地改动

### 阶段3：闪卡复习系统（Phase 2+）
**目标**：词汇库中的单词可以进行闪卡背诵

**需要做**：（留给Phase 2）
1. 闪卡UI组件
2. 复习间隔算法（SM-2 或 Leitner）
3. 复习数据存储和同步

---

## 第六步：现有代码改动清单

### 需要修改的文件

1. **backend/main.py**
   - 扩展`/highlight-words` endpoint，支持过滤已认识单词
   - 添加新API：`POST /user/known-words`、`GET /user/known-words`等
   - 添加用户认证相关的API（如果实现认证）

2. **frontend/content.js**
   - 加载`known_words` 从localStorage
   - 修改高亗逻辑，过滤已认识的单词
   - 在tooltip中添加"Mark as Known"按钮
   - 处理"Mark as Known"事件

3. **frontend/popup.html** 和 **popup.js**
   - 添加UI来显示和管理"已认识"的单词列表
   - 添加功能：查看、搜索、删除已认识的单词

4. **frontend/background.js**
   - 中继新的API请求（如需要）

### 需要新增的文件

1. **backend/auth.py** (如果实现认证)
   - 用户注册、登录逻辑

2. **frontend/auth.html** 和 **auth.js** (如果实现认证)
   - 登录/注册UI

---

## 总结

这个设计的核心思想：
- ✅ **两个独立维度**：高亗状态 + 词汇库状态
- ✅ **先实现本地，再做云同步**：MVP不依赖后端账户系统
- ✅ **为Phase 2预留设计空间**：闪卡功能的数据结构已经考虑
- ✅ **提升用户体验**：用户可以逐步从"mixed模式"过渡到"纯英文模式"

**建议的实现顺序**：
1. **本周**：实现阶段1（本地高亗过滤）✓ Happy Path测试
2. **后续**：实现认证 + 云同步（阶段2）
3. **更后续**：实现闪卡系统（阶段3）
