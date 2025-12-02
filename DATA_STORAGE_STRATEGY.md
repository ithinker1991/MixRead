# MixRead 数据存储战略分析

**日期**: 2025-12-02
**主题**: Google Cloud Storage vs 自托管数据库
**核心问题**: 域名排除配置、单词本、Known/Unknown 单词都放在 Google 云端可行吗？

---

## 📊 当前数据存储现状

### 你现在存储的数据

**后端数据库** (SQLite/MySQL):
```
users 表:
  ├─ user_id (主键)
  ├─ known_words_json (JSON 格式的已知单词列表)
  ├─ created_at / updated_at
  └─ relationships:
     ├─ unknown_words (表关系)
     ├─ vocabulary_entries (单词本)
     └─ library_entries (带上下文的单词库)

unknown_words 表:
  ├─ user_id + word (联合唯一索引)
  ├─ marked_at (标记时间)

vocabulary_entries 表:
  ├─ user_id + word (联合唯一索引)
  ├─ status (学习状态)
  ├─ added_at / last_reviewed
  └─ attempt_count (尝试次数)

library_entries 表:
  ├─ user_id + word (联合唯一索引)
  ├─ status (学习状态)
  ├─ contexts_json (上下文信息)
  └─ added_at
```

**存储成本估算** (现状):
```
假设 10,000 用户:
  - known_words: 100-500 单词/用户 → ~100 KB/用户
  - unknown_words: 50-200 单词/用户 → ~50 KB/用户
  - vocabulary_entries: 100-1000 单词/用户 → ~200 KB/用户
  - library_entries: 100-500 单词/用户 → ~500 KB/用户

  总计/用户: ~850 KB
  10,000 用户: ~8.5 GB

  数据库成本 (AWS RDS):
    小型 (t3.micro): ~$25/月
    中型 (t3.small): ~$50/月
    大型 (m5.large): ~$200+/月
```

---

## 🎯 新增需求: 域名排除配置

**域名排除配置数据**:
```
excluded_domains:
  ├─ user_id (主键)
  ├─ domains_json (JSON 数组)
  │  └─ ["localhost:8002", "localhost:3000", "api.example.com", ...]
  ├─ last_synced_at
  └─ sync_version (用于冲突解决)

数据大小估算:
  - 平均 10-50 个排除域名/用户
  - ~500 bytes/用户 (极小！)

  10,000 用户: ~5 MB (可忽略)
```

---

## 🚀 可行方案对比

### 方案 1: 完全使用 Google Cloud Storage ⭐ 推荐

**架构**:
```
前端 Extension
    ↓ (chrome.storage.sync)
Google Cloud
    ↑
包含:
  ✅ 域名排除配置 (excluded_domains)
  ✅ Known 单词列表 (known_words)
  ⚠️ Unknown 单词列表 (体积大，需要特殊处理)
  ⚠️ 单词本 (vocabulary_entries - 体积最大)
  ⚠️ 单词库 (library_entries with contexts - 体积最大)
```

**优点**:
- ✅ 零服务器成本
- ✅ 自动跨设备同步
- ✅ Google 负责备份和安全
- ✅ 离线支持 (本地缓存)
- ✅ 无维护成本

**缺点**:
- ❌ Chrome Storage API 限制: 100 KB/扩展
- ❌ 100 KB 根本装不下单词本和库
- ❌ 无法做复杂查询 (如按状态筛选)
- ❌ 无法做统计分析 (学习进度、统计数据)
- ❌ 无法实现高级功能 (推荐系统、协作学习)

**存储容量计算**:
```
Chrome Storage Sync 100 KB 限制

能装什么:
  ✅ 域名排除配置: 500 bytes → 99.5% 剩余
  ✅ Known 单词 (500 个): ~20 KB → 80% 剩余
  ❌ Unknown 单词 (200 个): ~10 KB (勉强)
  ❌ 单词本 (1000 个): ~200 KB (爆了！)
  ❌ 单词库 with contexts: ~500 KB (完全爆了！)

结论: 100 KB 只能放配置和 Known 单词
```

---

### 方案 2: 混合方案 ⭐⭐⭐ 最优

**架构**:
```
配置类数据 (小)
  └─ Google Cloud Storage
     ✅ 域名排除配置 (excluded_domains) - 500 bytes
     ✅ 用户偏好设置 (preferences) - 1 KB
     ✅ UI 状态 (difficulty_level 等) - 100 bytes

学习数据 (大)
  └─ 自有服务器数据库
     ✅ Known 单词列表 (索引快速查询)
     ✅ Unknown 单词列表 (需要频繁更新)
     ✅ 单词本 (vocabulary_entries)
     ✅ 单词库 (library_entries with contexts)
     ✅ 学习统计 (progress, streak, etc)

结果:
  - 配置数据: 云端同步 (自动, 无成本)
  - 学习数据: 中心化存储 (易查询, 易分析)
```

**为什么分离**:
```
Google Cloud Storage 适合:
  ✓ 小文件 (<100 KB)
  ✓ 配置和偏好
  ✓ 无需复杂查询
  ✓ 简单的增删改查

自有数据库适合:
  ✓ 大文件 (MB 级别)
  ✓ 频繁更新的数据
  ✓ 需要复杂查询 (JOIN, GROUP BY)
  ✓ 需要事务支持
  ✓ 需要备份和恢复
  ✓ 需要分析统计
```

---

### 方案 3: 完全自托管

**架构**:
```
前端 Extension
    ↓ (API 请求)
自有服务器
    ↓
自有数据库 (SQLite/MySQL/PostgreSQL)

包含:
  ✅ 域名排除配置
  ✅ Known 单词列表
  ✅ Unknown 单词列表
  ✅ 单词本 (vocabulary_entries)
  ✅ 单词库 (library_entries)
  ✅ 学习统计
```

**优点**:
- ✅ 完全控制
- ✅ 无大小限制
- ✅ 复杂查询和统计
- ✅ 适合未来扩展

**缺点**:
- ❌ 需要服务器 ($25-200+/月)
- ❌ 需要维护 (备份、监控、GDPR)
- ❌ 域名排除无法离线同步
- ❌ 用户没登录时无法同步配置

---

## 💰 成本分析

### 方案 1: 纯 Google Cloud Storage
```
一次性成本:
  前端代码改造: 2-3 天

月度成本:
  Google Cloud: $0
  数据库: $0 (无需后端存储)

年度成本:
  开发: ~4000-6000 RMB
  运维: $0

5 年总成本: ~4000-6000 RMB

限制: 无法存储大数据 (单词本)
      无法做统计分析
      无法实现高级功能
```

### 方案 2: 混合 (推荐) ⭐⭐⭐
```
一次性成本:
  前端代码: 3-5 天 (Google sync + API 调用)
  后端代码: 已有! (无需重复开发)

月度成本:
  Google Cloud: $0
  数据库 (RDS): $25-50/月
    - 配置级数据库 (小型足够)
    - 存储: ~8-10 GB

年度成本:
  开发: ~6000-8000 RMB (混合集成)
  运维: $300-600/年 ($25-50/月)

5 年总成本: ~7500-11000 RMB

优点: 配置云同步 + 数据本地化
      支持所有功能和统计
```

### 方案 3: 完全自托管
```
一次性成本:
  前端代码改造: 1-2 天 (仅 API 调用)
  后端代码: 已有! (无需改动)

月度成本:
  数据库 (RDS): $50-200/月
    - 中型实例 (处理更多用户)
    - 存储: ~8-10 GB + 增长

年度成本:
  开发: ~2000-4000 RMB (API 调用集成)
  运维: $600-2400/年 ($50-200/月)

5 年总成本: ~12000-28000 RMB

问题: 域名排除配置无法离线同步
      配置无法自动跨设备迁移
```

---

## 📋 详细功能对比

| 功能 | 纯 Google | 混合 (推荐) | 纯自托管 |
|------|----------|-----------|--------|
| **配置同步** | ✅ 自动 | ✅ 自动 | ❌ 需登录 |
| **离线支持** | ✅ 完美 | ✅ 完美 | ⚠️ 需实现 |
| **存储容量** | ❌ 100 KB | ✅ 无限 | ✅ 无限 |
| **Known 单词** | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| **Unknown 单词** | ⚠️ 勉强 | ✅ 支持 | ✅ 支持 |
| **单词本** | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| **单词库** | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| **学习统计** | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| **复杂查询** | ❌ 否 | ✅ 是 | ✅ 是 |
| **服务器成本** | $0 | $25-50/月 | $50-200/月 |
| **维护成本** | 低 | 低 | 中 |
| **开发时间** | 2-3 天 | 3-5 天 | 1-2 天 |

---

## 🎯 我的建议: 采用混合方案

### 为什么选混合?

**三大理由**:

1. **最佳的用户体验**
   ```
   - 域名排除配置自动同步 (无需登录后端)
   - Known 单词自动同步 (跨设备)
   - 所有其他数据持久存储 (功能完整)
   - 完全离线支持 (本地缓存 + 后端备份)
   ```

2. **成本最优** (相对功能)
   ```
   - 仅需 $25-50/月 数据库 (vs $50-200/月 纯自托管)
   - 已有后端代码，无需重复开发
   - 零 Google 云成本
   ```

3. **功能完整**
   ```
   ✓ 配置云同步
   ✓ 单词管理
   ✓ 学习统计
   ✓ 高级功能 (推荐, 复习)
   ✓ 数据分析
   ```

---

## 🛠️ 混合方案的技术实现

### 数据分类

**Google Cloud (chrome.storage.sync)**:
```javascript
{
  // 配置类 (无需经常访问)
  "excluded_domains": [
    "localhost:8002",
    "localhost:3000",
    ...
  ],
  "difficulty_level": "B1",
  "extension_enabled": true,

  // Known 单词 (频繁访问，但量小)
  "known_words": [
    "beautiful",
    "serendipity",
    ...
  ]  // ~500 个单词 = 20 KB
}

总大小: ~25-30 KB (远低于 100 KB 限制)
```

**自有数据库**:
```sql
users 表:
  - user_id, created_at, updated_at

unknown_words 表:
  - user_id, word, marked_at

vocabulary_entries 表:
  - user_id, word, status, added_at, last_reviewed, attempt_count

library_entries 表:
  - user_id, word, status, added_at, contexts_json

-- 新增 (可选)
learning_stats 表:
  - user_id, daily_added, total_words, streak, ...

reading_history 表:
  - user_id, url, content, timestamp, ...
```

---

## 📝 实现步骤

### Phase 1: 域名排除功能 (当前)

**使用方案**: Chrome Cloud Sync
```
Week 1-3: 实现 exclusion-store.js
  - 使用 chrome.storage.sync
  - 自动同步
  - Known 单词也同步 (顺便)

存储数据:
  {
    "excluded_domains": [...],
    "known_words": [...]  // 额外同步
  }
```

### Phase 2: 扩展现有功能

**现状**: 已有后端 API 和数据库
```
情况:
  - 单词本: 已有 (vocabulary_entries)
  - Unknown 单词: 已有 (unknown_words)
  - Library: 已有 (library_entries)

行动: 无需改动!

前端:
  1. 保留现有 API 调用
  2. 添加 Google Sync 同步 Known 单词
  3. Unknown 单词继续走 API (数据库存储)
  4. 单词本继续走 API (数据库存储)
  5. 单词库继续走 API (数据库存储)
```

### Phase 3: 增强功能 (未来)

```
可选:
  - 学习统计 (database)
  - 推荐系统 (database)
  - 协作学习 (database)
  - 阅读历史 (database)
  - 数据分析 (database)
```

---

## 🔄 同步流程详解

### Known 单词的双向同步

```
情况 A: 用户在设备 A 标记单词为 Known
  设备 A → chrome.storage.sync → Google Cloud
       ↓
  设备 B (同一 Google 账户)
       ↓ (自动监听 onChanged)
  chrome.storage.local (本地缓存)
       ↓
  API 调用: POST /users/{user_id}/known-words
       ↓
  数据库: users 表更新 known_words_json
```

**关键点**:
```javascript
// 设备 A
await exclusionStore.markWordAsKnown(word);
// → chrome.storage.sync 更新
// → Google Cloud 接收

// 设备 B (自动)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && 'known_words' in changes) {
    const newWords = changes.known_words.newValue;
    // 同时做两件事:
    // 1. 更新本地缓存 (立即用)
    // 2. 调用 API 同步到后端 (备份)
    await syncToBackend(newWords);
  }
});
```

---

## 🎓 为什么不用纯 Google?

**成本的假象**:
```
"Google Storage 零成本,不用服务器可以省钱"

但是...
```

**需要放弃的功能**:
```
❌ 单词本 (vocabulary_entries) - 核心功能
❌ 单词库 (library_entries) - 核心功能
❌ Unknown 单词 (超过 100 KB 限制)
❌ 学习统计 (无数据库无法统计)
❌ 推荐系统 (无复杂查询无法实现)
❌ 高级复习 (无状态跟踪无法实现)
```

**实际成本**:
```
如果用纯 Google:
  - 开发: 2-3 天 (省 1-2 天)
  - 服务器: $0/月 (省 $25-50/月)

  → 直观上省钱

但失去:
  - 单词本功能 (用户刚做好的!)
  - 学习进度跟踪
  - 未来的高级功能

  → 实际上损失 > 节省
```

---

## ✅ 最终建议

### 立即采用: 混合方案

**架构决策**:
```
├─ 配置数据 (excluded_domains, difficulty_level)
│  └─ Google Cloud Storage (自动同步)
│
├─ Known 单词列表
│  ├─ Google Cloud (实时同步)
│  └─ 后端数据库 (备份)
│
└─ 其他学习数据
   ├─ Unknown 单词
   ├─ 单词本 (vocabulary_entries)
   ├─ 单词库 (library_entries)
   ├─ 学习统计
   └─ 后端数据库 (已有)
```

### 实施步骤

**今天 (Phase 1)**:
```
1. 决策: 选择混合方案 ✓
2. 实现: Domain Exclusion (Chrome Sync)
3. 包含: Known 单词同步 (顺便做了)
```

**下周 (Phase 2)**:
```
1. 前端: 集成 Known 单词的双向同步
2. 后端: 无需改动 (已有 API)
3. 验证: 多设备测试
```

**后续 (Phase 3+)**:
```
1. 增强现有功能
2. 添加学习统计
3. 构建推荐系统
```

---

## 📊 成本节省

**vs 纯自托管**:
```
纯自托管方案:
  - 服务器: $50-200/月
  - 年成本: $600-2400/年

混合方案:
  - 服务器: $25-50/月 (小型足够)
  - Google: $0
  - 年成本: $300-600/年

节省: $300-1800/年 (50%)
```

---

## 🎯 三言两语

**问题**: 单词本、Known/Unknown 数据能放 Google 吗?

**答案**:
```
✅ Known 单词: 可以 (量小, 频繁同步)
✅ 配置数据: 可以 (极小, 自动同步)

❌ Unknown 单词: 不建议 (量大, 超过 100 KB)
❌ 单词本: 不建议 (量最大, 需复杂查询)
❌ 单词库: 不建议 (量大, 需上下文处理)

最优: 混合方案
  - 配置 + Known 单词 → Google (自动同步)
  - 其他数据 → 自有数据库 (已有基础)

成本: 仅需 $25-50/月 (vs $50-200/月)
功能: 完整 (无功能阉割)
```

---

## 📚 参考

- `CLOUD_SYNC_IMPLEMENTATION_GUIDE.md` - Chrome Sync 技术细节
- `ARCHITECTURE_DECISION_SUMMARY.md` - 架构对比分析
- `/backend/infrastructure/models.py` - 当前数据模型

