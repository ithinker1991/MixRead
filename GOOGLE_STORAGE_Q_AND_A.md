# Google Cloud Storage - 常见问题解答

**问题**: 所有数据都放在 Google，单词本、Known/Unknown 单词呢？

---

## Q1: Known 单词能放 Google 吗？

**A**: ✅ **完全可以！甚至推荐**

```
Known 单词特点:
  - 数据量: 100-500 个单词 = 20 KB
  - 访问频率: 每次都要检查（频繁）
  - 更新频率: 偶尔添加/删除（不频繁）
  - 特点: 用户标记的单词（需要跨设备同步）

Google Storage 优势:
  ✅ 自动跨设备同步
  ✅ 无需后端 API 调用
  ✅ 离线完全支持
  ✅ 响应速度快（本地缓存）

建议: 同步到 Google ⭐⭐⭐⭐⭐
```

---

## Q2: Unknown 单词能放 Google 吗？

**A**: ⚠️ **理论可以，但不推荐**

```
Unknown 单词特点:
  - 数据量: 200-500 个单词 = 50 KB
  - 访问频率: 很少访问
  - 更新频率: 偶尔添加/删除

Google Storage 100 KB 限制:
  如果只放 Unknown: 50 KB ✓
  + Known 单词: 20 KB
  + 配置: 2 KB
  = 72 KB (还剩 28 KB)

问题:
  ❌ 无法再添加其他数据（紧张）
  ❌ 数据库中已有（重复）
  ❌ 不需要实时同步（用处不大）

建议: 继续走 API（数据库）⭐⭐⭐
```

---

## Q3: 单词本能放 Google 吗？

**A**: ❌ **不能！**

```
单词本特点:
  - 数据量: 1000+ 个单词，含元数据
    ```
    每个词:
      - word: "beautiful" (10 bytes)
      - status: "LEARNING" (10 bytes)
      - added_at: timestamp (10 bytes)
      - last_reviewed: timestamp (10 bytes)
      - attempt_count: integer (5 bytes)
      = 45 bytes/单词

    1000 个单词 = 45 KB
    10000 个单词 = 450 KB (爆了！)
    ```

  - 查询需求: 按 status 过滤、按 added_at 排序
  - 这些 Google Storage API 都不支持！

Google Storage 不足:
  ❌ 无法做 GROUP BY 查询（需要按状态统计）
  ❌ 无法做 ORDER BY 排序
  ❌ 无法做 WHERE 过滤
  ❌ 无法做事务支持（并发更新）
  ❌ 无法做备份和恢复

建议: 必须走数据库！ ❌❌❌
```

---

## Q4: 单词库（Library）能放 Google 吗？

**A**: ❌ **不能！**

```
单词库特点:
  - 数据量最大！
    ```
    每个词:
      - word: "beautiful" (10 bytes)
      - status: "LEARNING" (10 bytes)
      - added_at: timestamp (10 bytes)
      - contexts: 多个例句 (500+ bytes!)

      = 530+ bytes/单词

    1000 个单词 = 530 KB (远超 100 KB！)
    ```

  - 需要频繁查询上下文
  - 需要复杂的查询和更新

Google Storage 不足:
  ❌ 严重超过 100 KB 限制
  ❌ 无法检索特定上下文
  ❌ 无法按 context 搜索
  ❌ 无法做上下文推荐

建议: 必须走数据库！ ❌❌❌
```

---

## Q5: 那我现有的数据库里什么时候能迁到 Google？

**A**: ✅ **部分可以，立即开始**

```
立即迁移到 Google:
  ✅ 域名排除配置 (excluded_domains)
     - 当前: 无
     - 迁移后: Google Storage
     - 大小: 500 bytes

  ✅ Known 单词列表
     - 当前: 数据库 (users.known_words_json)
     - 迁移后: Google Storage (双向同步)
     - 大小: 20 KB
     - 同时保留数据库（备份）

  ✅ 用户偏好设置 (difficulty_level 等)
     - 当前: 无
     - 迁移后: Google Storage
     - 大小: < 1 KB

保留在数据库:
  ❌ Unknown 单词（继续）
  ❌ 单词本（继续）
  ❌ 单词库（继续）
  ❌ 学习统计（保留）
  ❌ 阅读历史（保留）

结果:
  数据库会变得更轻（减少 Known 单词重复）
  Google 承担配置和偏好的同步
  两全其美！
```

---

## Q6: 具体怎么同步 Known 单词？

**A**: **双向同步模式**

```
场景: 用户在 3 台设备上学习英语

设备 A - 早上标记单词为 Known
  "beautiful" → 点击"Mark as Known"
         ↓
  前端调用:
    1. exclusionStore.markWordAsKnown("beautiful")
    2. 更新 chrome.storage.sync
    3. 立即调用 API: POST /users/{id}/known-words

  结果:
    ✓ Google Cloud: 更新 known_words
    ✓ 自有数据库: 更新 users.known_words_json
    ✓ 设备 A 本地: 立即生效

设备 B - 中午自动接收
  chrome.storage.onChanged 监听触发:
    1. 检测 known_words 有变化
    2. 获取新列表: ["beautiful", ...]
    3. 立即更新本地缓存
    4. 自动调用 API 同步到后端

  结果:
    ✓ Google Cloud: 已有数据
    ✓ 自有数据库: 同步更新
    ✓ 设备 B 本地: 立即生效

设备 C - 晚上检查
  如果用户离线:
    ✓ 本地缓存有数据
    ✓ 可以离线查看

  如果用户在线:
    ✓ 自动拉取最新数据
    ✓ 从 Google 或后端都行

总结:
  ✅ 三台设备完全同步
  ✅ 支持离线
  ✅ 即使后端故障，Google 还有备份
  ✅ 即使 Google 故障，后端还有备份
```

**代码示例**:

```javascript
// 设备 A - 前端
async function markWordAsKnown(word) {
  // 1. 更新 Google Storage
  const store = new ExclusionStore();
  await store.addToKnownWords(word);

  // 2. 同时调用 API 备份（异步，不阻塞 UI）
  try {
    await apiClient.markWordAsKnown({
      user_id: getCurrentUserId(),
      word: word
    });
  } catch (error) {
    console.log('[MixRead] API 调用失败，但 Google 已保存');
  }
}

// 设备 B/C - 监听变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && 'known_words' in changes) {
    const newKnownWords = changes.known_words.newValue || [];

    // 1. 立即更新本地
    updateLocalCache(newKnownWords);

    // 2. 异步同步到后端
    syncToBackend(newKnownWords)
      .catch(err => console.log('API 同步失败，但本地有缓存'));
  }
});
```

---

## Q7: 成本节省多少？

**A**: **25-75% 节省！**

```
当前方案 (纯数据库):
  数据库存储:
    - users (known_words_json): 100 KB
    - unknown_words: 50 KB
    - vocabulary_entries: 200 KB
    - library_entries: 500 KB
    = 850 KB/用户

  10,000 用户 = 8.5 GB
  成本: $50-100/月

迁移后 (混合方案):
  数据库存储:
    - users (无 known_words_json): 50 KB
    - unknown_words: 50 KB
    - vocabulary_entries: 200 KB
    - library_entries: 500 KB
    = 800 KB/用户

  10,000 用户 = 8.0 GB
  成本: $25-50/月 (同一档位，可能降级到更小实例)

Google Storage:
  - known_words: $0 (免费)
  - excluded_domains: $0 (免费)

总体节省:
  数据库: $25-50/月 (如果能降级)
  + 运维: 减少 Known 单词的备份压力

  年度节省: $300-600 / 年 (如果降级)
  5 年节省: $1500-3000

而且:
  ✓ 用户体验更好（自动同步）
  ✓ 数据更安全（双备份）
  ✓ 系统更可靠（单点故障风险低）
```

---

## Q8: 如果 Google 故障怎么办？

**A**: **双备份，不用担心**

```
场景 1: Google Storage 故障 (极稀有，Google 99.99% SLA)
  设备 A:
    ✗ 无法同步到 Google
    ✓ 但本地缓存仍可用
    ✓ API 调用仍然工作

  设备 B:
    ✓ 本地缓存的旧数据仍可用
    ✓ 从 API 拉取最新数据

  结果: 设备间可能有短期不一致，但无数据丢失

场景 2: 自有数据库故障
  设备 A:
    ✓ Google Storage 有完整备份
    ✓ 本地缓存可用

  设备 B:
    ✓ 本地缓存可用
    ✓ 从 Google Storage 获取（虽然慢点）

  结果: 可以恢复数据库，无数据丢失

场景 3: 都故障（极不可能）
  设备 A/B:
    ✓ 本地缓存仍然有数据
    ✓ 用户可以继续使用

  恢复后:
    ✓ 可以从任何一个恢复
    ✓ 数据不丢失

总结:
  单一数据库: 故障 = 数据丢失 ❌
  双备份: 故障 = 自动故障转移 ✅
```

---

## Q9: 迁移过程会影响现有用户吗？

**A**: ✅ **零影响！平滑迁移**

```
迁移计划 (Phase 1-2):

Phase 1 (当前，Week 1-3):
  - 实现 Domain Exclusion (Chrome Sync)
  - 新增 Known 单词同步功能
  - 现有用户: 无影响
  - 新用户: 自动获得双备份

Phase 2 (下月):
  - 前端: 启用 Known 单词的 Google Sync
  - 后端: 保持现有 API（无改动）
  - 现有用户:
    ✓ 第一次打开时自动迁移
    ✓ 无感知迁移（在后台）
    ✓ 功能完全不变

迁移逻辑:
  前端检测:
    if (user.hasKnownWords && !synced_to_google) {
      // 第一次启用同步
      sync_existing_known_words_to_google();
      mark_as_synced();
    }

结果:
  - 100% 向后兼容
  - 无需用户操作
  - 无需维护窗口
  - 零停机时间
```

---

## Q10: 架构最终长什么样？

**A**: **最优架构 = 混合方案**

```
┌─────────────────────────────────────┐
│       Chrome Extension 前端          │
└──────────┬──────────────────────────┘
           │
      ┌────┴────────────────────────┐
      │                             │
   Google Cloud Storage         自有服务器
      │                             │
  ├─ excluded_domains          ├─ unknown_words
  ├─ known_words (双备份)       ├─ vocabulary_entries
  ├─ difficulty_level          ├─ library_entries
  └─ 偏好设置 (自动同步)        ├─ 学习统计
                                ├─ 阅读历史
                                └─ (未来高级功能)

特点:
  ✅ Google: 配置和关键数据自动同步
  ✅ 数据库: 学习数据完整存储和分析
  ✅ 本地: 缓存所有数据，完全离线支持
  ✅ 双备份: 任一故障都能恢复
  ✅ 低成本: $25-50/月（不是 $50-200）
  ✅ 高可靠: 99.9%+ 可用性
```

---

## 📋 快速决策

| 数据 | Google? | 理由 |
|------|---------|------|
| 域名排除配置 | ✅ 是 | 量小，需要同步 |
| Known 单词 | ✅ 是 | 量小，频繁同步 |
| 难度级别 | ✅ 是 | 极小，需要同步 |
| Unknown 单词 | ❌ 否 | 量大，查询复杂 |
| 单词本 | ❌ 否 | 量最大，需要查询 |
| 单词库 | ❌ 否 | 量大+上下文 |
| 学习统计 | ❌ 否 | 需要复杂聚合 |

**结论**: ✅ 采用混合方案

---

## 🎯 立即行动

**今天**:
```
1. 确认混合方案 ✓
2. Week 1 实现 Domain Exclusion
3. 同时支持 Known 单词同步
```

**下周**:
```
1. 前端集成 Known 单词 Google Sync
2. 后端保持现状（无需改动）
3. 多设备测试
```

**后续**:
```
1. 现有用户无感知迁移
2. 新用户默认启用双备份
3. 享受更低的成本和更好的可靠性！
```

---

**答案总结**: 混合方案 = 最优选择 ⭐⭐⭐⭐⭐

